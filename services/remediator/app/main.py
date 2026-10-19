import structlog
from fastapi import FastAPI, Query
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import get_settings
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name
app = FastAPI(title=SERVICE)
Instrumentator().instrument(app).expose(app)

# Journal horodaté des remédiations, du plus ancien au plus récent.
# Format d'un événement : {"ts", "type", "target", "action", "status", "detail"}
# status ∈ detected | running | recovered | failed | escalated
# Phase 7 : alimenté par POST /alert et l'exécution des playbooks Ansible.
EVENTS: list[dict] = []


@app.get("/events")
async def events(limit: int = Query(default=50, ge=1, le=500)):
    """Journal des remédiations, du plus récent au plus ancien."""
    return list(reversed(EVENTS[-limit:]))


@app.get("/health")
async def health():
    return {"status": "ok", "service": SERVICE, "deps": {}}
