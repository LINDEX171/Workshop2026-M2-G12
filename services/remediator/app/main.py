import asyncio

import structlog
from fastapi import BackgroundTasks, Body, FastAPI, Query
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import get_settings
from app.engine import Remediator
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name
app = FastAPI(title=SERVICE)
Instrumentator().instrument(app).expose(app)

remediator = Remediator(settings)


def normalize(payload: dict) -> list[dict]:
    """Ramène les deux formats d'alerte à une liste d'incidents {type, target, score}."""
    if "alerts" in payload:  # webhook Alertmanager
        incidents = []
        for a in payload["alerts"]:
            if a.get("status") == "resolved":
                continue
            labels = a.get("labels", {})
            incidents.append({
                "type": labels.get("type", "unknown"),
                "target": labels.get("target"),
                "source": "alertmanager",
                "score": None,
            })
        return incidents
    return [{  # format detector
        "type": payload.get("type", "unknown"),
        "target": payload.get("target"),
        "source": "detector",
        "score": payload.get("score"),
    }]


@app.post("/alert", status_code=202)
async def alert(background: BackgroundTasks, payload: dict = Body(...)):
    """Reçoit les alertes du detector ou d'Alertmanager et lance la remédiation en tâche de fond."""
    incidents = normalize(payload)
    for incident in incidents:
        log.warning("alert_received", source=incident["source"], type=incident["type"],
                    target=incident["target"], score=incident["score"])
        background.add_task(remediator.handle, incident)
    return {"accepted": True, "incidents": len(incidents)}


@app.get("/events")
async def events(limit: int = Query(default=50, ge=1, le=500)):
    """Journal des remédiations, du plus récent au plus ancien."""
    return list(reversed(remediator.events[-limit:]))


@app.get("/health")
async def health():
    return {"status": "ok", "service": SERVICE, "deps": {}}
