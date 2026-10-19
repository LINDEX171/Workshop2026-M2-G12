from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app import status
from app.config import get_settings
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name

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


def current_score() -> dict:
    # Phase 6 : score calculé par l'Isolation Forest sur les features Prometheus
    return {"score": None, "threshold": settings.detector_threshold, "model_loaded": False}


@app.get("/score")
async def score():
    return current_score()


@app.get("/status")
async def platform_status():
    """Vue agrégée en lecture seule pour le tableau de bord du frontend."""
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
async def health():
    return {"status": "ok", "service": SERVICE, "deps": {}}
