import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from prometheus_fastapi_instrumentator import Instrumentator

from app import status
from app.config import get_settings
from app.engine import Engine
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name
engine = Engine(settings)

_http: httpx.AsyncClient | None = None


def http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=2.0)
    return _http


async def detection_loop() -> None:
    while True:
        try:
            await engine.tick(http())
        except httpx.HTTPError as exc:
            log.error("prometheus_unreachable", error=str(exc))
        except Exception as exc:
            log.exception("detection_error", error=str(exc))
        await asyncio.sleep(settings.detector_interval_sec)


@asynccontextmanager
async def lifespan(_: FastAPI):
    engine.maybe_reload()
    task = asyncio.create_task(detection_loop())
    yield
    task.cancel()
    if _http is not None:
        await _http.aclose()


app = FastAPI(title=SERVICE, lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


def current_score() -> dict:
    return {
        "score": engine.last["score"],
        "threshold": engine.threshold,
        "model_loaded": engine.detector is not None,
        "components": engine.last.get("components", {}),
        "features": engine.last["features"],
        "top_features": engine.last["top_features"],
        "updated_at": engine.last["updated_at"],
    }


async def require_token(authorization: str | None = Header(default=None)) -> dict:
    """Valide le jeton auprès de auth : la vue de supervision n'est pas publique."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Token manquant", headers={"WWW-Authenticate": "Bearer"})
    try:
        r = await http().get(f"{settings.auth_url}/verify", headers={"Authorization": authorization})
    except httpx.HTTPError:
        raise HTTPException(503, "Service d'authentification indisponible")
    if r.status_code == 200:
        return r.json()
    raise HTTPException(401, "Token invalide", headers={"WWW-Authenticate": "Bearer"})


@app.get("/score")
async def score():
    return current_score()


@app.get("/status")
async def platform_status(_: dict = Depends(require_token)):
    """Vue agrégée pour le tableau de bord — réservée aux utilisateurs authentifiés."""
    urls = {
        "auth": settings.auth_url,
        "payment-api": settings.payment_url,
        "assistant": settings.assistant_url,
        "remediator": settings.remediator_url,
    }
    services = await status.collect_services(http(), urls)
    events = await status.fetch_events(http(), settings.remediator_url)
    score_info = current_score()
    phase = status.compute_phase(
        services,
        score_info["score"],
        score_info["threshold"],
        events,
        settings.status_after_window_sec,
    )
    return {
        "phase": phase,
        "services": services,
        "score": score_info,
        "events": events,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
async def health(response: Response):
    try:
        r = await http().get(f"{settings.prometheus_url}/-/healthy")
        prom_ok = r.status_code == 200
    except httpx.HTTPError:
        prom_ok = False
    if not prom_ok:
        response.status_code = 503
    return {
        "status": "ok" if prom_ok else "degraded",
        "service": SERVICE,
        "deps": {
            "prometheus": "ok" if prom_ok else "ko",
            "model": "loaded" if engine.detector is not None else "missing",
        },
    }
