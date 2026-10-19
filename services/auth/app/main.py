from contextlib import asynccontextmanager

import jwt
import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from prometheus_client import Counter
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app import db, security
from app.config import get_settings
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name

LOGIN_TOTAL = Counter("auth_login_total", "Tentatives de login", ["result"])


def bootstrap_operator() -> None:
    """Crée l'utilisateur opérateur depuis le secret operator_password."""
    password = settings.operator_password.get_secret_value()
    if not password:
        log.warning("operator_bootstrap_skipped", reason="secret operator_password absent")
        return
    try:
        created = db.ensure_user(
            settings.operator_username, security.hash_password(password), "operator"
        )
        log.info("operator_bootstrap", username=settings.operator_username, created=created)
    except SQLAlchemyError as exc:
        log.error("operator_bootstrap_failed", error=str(exc))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.jwt_secret.get_secret_value():
        raise RuntimeError("Secret jwt_secret absent : démarrage refusé")
    await run_in_threadpool(bootstrap_operator)
    yield


app = FastAPI(title=SERVICE, lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(_: Request, exc: SQLAlchemyError):
    log.error("db_error", error=str(exc))
    return JSONResponse(status_code=503, content={"detail": "Base d'authentification indisponible"})


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


def client_ip(request: Request) -> str:
    """IP réelle du client (le WAF la transmet dans X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def current_claims(authorization: str | None = Header(default=None)) -> dict:
    unauthorized = HTTPException(
        status_code=401,
        detail="Token manquant ou invalide",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized
    try:
        return security.decode_token(authorization[7:].strip())
    except jwt.InvalidTokenError:
        raise unauthorized


@app.post("/login")
def login(body: LoginIn, request: Request):
    user = db.get_user(body.username)
    if not security.verify_password(body.password, user["password_hash"] if user else None):
        LOGIN_TOTAL.labels(result="failure").inc()
        log.warning("login_failed", username=body.username, client_ip=client_ip(request))
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    LOGIN_TOTAL.labels(result="success").inc()
    log.info("login_success", username=user["username"], client_ip=client_ip(request))
    return {
        "token": security.create_token(user["username"], user["role"]),
        "token_type": "bearer",
        "expires_in": settings.jwt_expire_min * 60,
    }


@app.get("/verify")
def verify(claims: dict = Depends(current_claims)):
    return {"valid": True, "sub": claims["sub"], "role": claims["role"], "exp": claims["exp"]}


@app.get("/me")
def me(claims: dict = Depends(current_claims)):
    return {"username": claims["sub"], "role": claims["role"]}


@app.get("/health")
def health(response: Response):
    db_ok = db.ping()
    if not db_ok:
        response.status_code = 503
    return {
        "status": "ok" if db_ok else "degraded",
        "service": SERVICE,
        "deps": {"db": "ok" if db_ok else "ko"},
    }
