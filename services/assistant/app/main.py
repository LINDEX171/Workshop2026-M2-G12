import asyncio
from contextlib import asynccontextmanager
from typing import Literal

import httpx
import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Response
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
                break
        except Exception as exc:
            log.info("index_retry", reason=str(exc))
        await asyncio.sleep(10)
    # Préchauffage séparé : un échec ici ne doit pas relancer toute l'indexation
    try:
        await run_in_threadpool(assistant.warmup)
    except Exception as exc:
        log.warning("warmup_failed", reason=str(exc))


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(index_when_ready())
    yield
    task.cancel()


app = FastAPI(title=SERVICE, lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=2000)


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    history: list[Turn] = Field(default_factory=list, max_length=6)


async def require_token(authorization: str | None = Header(default=None)) -> dict:
    """Valide le jeton auprès de auth : l'assistant n'est pas public."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Token manquant", headers={"WWW-Authenticate": "Bearer"})
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{settings.auth_url}/verify", headers={"Authorization": authorization})
    except httpx.HTTPError:
        raise HTTPException(503, "Service d'authentification indisponible")
    if r.status_code == 200:
        return r.json()
    raise HTTPException(401, "Token invalide", headers={"WWW-Authenticate": "Bearer"})


@app.post("/ask")
async def ask(body: AskIn, _: dict = Depends(require_token)):
    if assistant.indexed == 0:
        raise HTTPException(status_code=503, detail="Index non prêt (Ollama/modèles en cours ?)")
    try:
        with ASK_LATENCY.time():
            history = [t.model_dump() for t in body.history]
            result = await run_in_threadpool(assistant.ask, body.question, history)
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
