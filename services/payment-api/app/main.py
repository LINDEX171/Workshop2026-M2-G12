import time
from contextlib import asynccontextmanager
from decimal import Decimal

import httpx
import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.config import get_settings
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name

# --- Métriques métier ---
TX_TOTAL = Counter("tx_total", "Transactions traitées", ["status"])
TX_FAILED = Counter("tx_failed_total", "Transactions en échec (rejet métier ou erreur technique)")
TX_LATENCY = Histogram(
    "tx_latency_seconds",
    "Durée de traitement d'une transaction",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

_http: httpx.AsyncClient | None = None


def http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=2.0)
    return _http


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    if _http is not None:
        await _http.aclose()


app = FastAPI(title=SERVICE, lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(_: Request, exc: SQLAlchemyError):
    log.error("db_error", error=str(exc))
    return JSONResponse(status_code=503, content={"detail": "Base de données indisponible"})


async def require_token(authorization: str | None = Header(default=None)) -> dict:
    """Délègue la validation du token au service auth (GET /verify)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, detail="Token manquant", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        r = await http().get(f"{settings.auth_url}/verify", headers={"Authorization": authorization})
    except httpx.HTTPError as exc:
        log.error("auth_unreachable", error=str(exc))
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    if r.status_code == 200:
        return r.json()
    if r.status_code == 401:
        raise HTTPException(
            status_code=401, detail="Token invalide", headers={"WWW-Authenticate": "Bearer"}
        )
    raise HTTPException(status_code=503, detail="Service d'authentification indisponible")


class TransactionIn(BaseModel):
    src: int | None = Field(default=None, gt=0, description="Compte débité (défaut : compte 1)")
    dst: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    @model_validator(mode="after")
    def distinct_accounts(self):
        if self.src is not None and self.src == self.dst:
            raise ValueError("src et dst doivent être différents")
        return self


@app.post("/transactions")
async def create_transaction(body: TransactionIn, claims: dict = Depends(require_token)):
    src = body.src or settings.default_src_account
    if src == body.dst:
        raise HTTPException(status_code=422, detail="src et dst doivent être différents")

    start = time.perf_counter()
    try:
        tx = await run_in_threadpool(db.create_transfer, src, body.dst, body.amount)
    except db.AccountNotFound:
        TX_TOTAL.labels(status="rejected").inc()
        TX_FAILED.inc()
        raise HTTPException(status_code=404, detail="Compte inconnu")
    except SQLAlchemyError:
        TX_TOTAL.labels(status="error").inc()
        TX_FAILED.inc()
        raise
    finally:
        TX_LATENCY.observe(time.perf_counter() - start)

    TX_TOTAL.labels(status=tx["status"]).inc()
    log.info(
        "transaction",
        tx_id=tx["id"],
        status=tx["status"],
        src=src,
        dst=body.dst,
        amount=str(body.amount),
        user=claims.get("sub"),
    )
    if tx["status"] != "accepted":
        TX_FAILED.inc()
        return JSONResponse(
            status_code=422,
            content={"id": tx["id"], "status": tx["status"], "detail": "Solde insuffisant"},
        )
    return {"id": tx["id"], "status": tx["status"]}


@app.get("/transactions")
async def list_transactions(
    limit: int = Query(default=50, ge=1, le=500), _: dict = Depends(require_token)
):
    return await run_in_threadpool(db.list_transactions, limit)


@app.get("/transactions/{tx_id}")
async def get_transaction(tx_id: int, _: dict = Depends(require_token)):
    tx = await run_in_threadpool(db.get_transaction, tx_id)
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction inconnue")
    return tx


@app.get("/accounts")
async def list_accounts(_: dict = Depends(require_token)):
    return await run_in_threadpool(db.list_accounts)


async def check_auth() -> bool:
    try:
        r = await http().get(f"{settings.auth_url}/health")
        return r.status_code == 200
    except httpx.HTTPError:
        return False


@app.get("/health")
async def health(response: Response):
    db_ok = await run_in_threadpool(db.ping)
    auth_ok = await check_auth()
    healthy = db_ok and auth_ok
    if not healthy:
        response.status_code = 503
    return {
        "status": "ok" if healthy else "degraded",
        "service": SERVICE,
        "deps": {"db": "ok" if db_ok else "ko", "auth": "ok" if auth_ok else "ko"},
    }
