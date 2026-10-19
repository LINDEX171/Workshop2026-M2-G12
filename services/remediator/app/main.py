import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import get_settings
from app.logging import setup_logging

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name
app = FastAPI(title=SERVICE)
Instrumentator().instrument(app).expose(app)


@app.get("/health")
async def health():
    return {"status": "ok", "service": SERVICE, "deps": {}}
