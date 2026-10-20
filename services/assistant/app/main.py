import asyncio
from contextlib import asynccontextmanager

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

from app.config import get_settings
from app.logging import setup_logging
from app.rag import Assistant

settings = get_settings()
setup_logging(settings.service_name, settings.log_level)
log = structlog.get_logger()

SERVICE = settings.service_name
assistant = Assistant(settings)

ASK_TOTAL = Counter("assistant_ask_total", "Questions posées à l'assistant", ["result"])
ASK_LATENCY = Histogram("assistant_ask_seconds", "Durée d'une réponse RAG")
for _r in ("ok", "error"):  # pré-crée les séries pour qu'elles apparaissent dans /metrics
    ASK_TOTAL.labels(result=_r)


async def index_when_ready() -> None:
    """Indexe la doc dès qu'Ollama et le modèle d'embeddings sont prêts (retries)."""
    for _ in range(30):
        try:
            await run_in_threadpool(assistant.index)
            if assistant.indexed:
                return
        except Exception as exc:
            log.info("index_retry", reason=str(exc))
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(index_when_ready())
    yield
    task.cancel()


app = FastAPI(title=SERVICE, lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)


@app.post("/ask")
async def ask(body: AskIn):
    if assistant.indexed == 0:
        raise HTTPException(status_code=503, detail="Index non prêt (Ollama/modèles en cours ?)")
    try:
        with ASK_LATENCY.time():
            result = await run_in_threadpool(assistant.ask, body.question)
    except Exception as exc:
        ASK_TOTAL.labels(result="error").inc()
        log.error("ask_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="L'assistant (Ollama) est indisponible")
    ASK_TOTAL.labels(result="ok").inc()
    return result


@app.post("/reindex")
async def reindex():
    n = await run_in_threadpool(assistant.index)
    if n == 0:
        raise HTTPException(status_code=503, detail="Indexation impossible (Ollama/modèles ?)")
    return {"indexed_chunks": n}


async def ollama_ready() -> bool:
    try:
        r = await httpx.AsyncClient(timeout=2.0).get(f"{settings.ollama_url}/api/tags")
        return r.status_code == 200
    except httpx.HTTPError:
        return False


@app.get("/health")
async def health(response: Response):
    ok = await ollama_ready()
    if not ok:
        response.status_code = 503
    return {
        "status": "ok" if ok else "degraded",
        "service": SERVICE,
        "deps": {"ollama": "ok" if ok else "ko", "index": assistant.indexed},
    }
