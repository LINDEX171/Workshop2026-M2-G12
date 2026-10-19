"""Agrégation de l'état de la plateforme pour le tableau de bord (GET /status).

Le frontend ne voit pas le réseau `ops` : le detector, présent sur `app` et `ops`,
lit la santé de chaque service, le score d'anomalie et le journal du remediator,
et renvoie une vue unique en lecture seule.
"""
import asyncio
from datetime import datetime, timezone

import httpx

# Statuts d'événement de remédiation qui signifient « incident en cours »
INCIDENT_EVENT_STATUSES = {"detected", "running", "failed", "escalated"}


async def probe(client: httpx.AsyncClient, url: str) -> tuple[bool, dict]:
    """GET <url>/health -> (sain ?, corps JSON)."""
    try:
        r = await client.get(f"{url}/health")
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        return r.status_code == 200, body
    except (httpx.HTTPError, ValueError):
        return False, {}


async def fetch_events(client: httpx.AsyncClient, remediator_url: str, limit: int = 20) -> list[dict]:
    try:
        r = await client.get(f"{remediator_url}/events", params={"limit": limit})
        r.raise_for_status()
        return r.json()
    except (httpx.HTTPError, ValueError):
        return []


def dep_state(healthy: bool | None, body: dict, dep: str) -> str:
    """État d'une dépendance déclarée dans le /health d'un service (ex. db de payment-api)."""
    value = body.get("deps", {}).get(dep)
    if value in ("ok", "ko"):
        return value
    return "unknown"


async def collect_services(client: httpx.AsyncClient, urls: dict[str, str]) -> dict[str, str]:
    names = list(urls)
    results = await asyncio.gather(*(probe(client, urls[n]) for n in names))
    probes = dict(zip(names, results))

    services = {"detector": "ok"}
    for name, (healthy, _) in probes.items():
        services[name] = "ok" if healthy else "ko"
    if "payment-api" in probes:
        services["db"] = dep_state(*probes["payment-api"], "db")
    if "auth" in probes:
        services["auth-db"] = dep_state(*probes["auth"], "db")
    return services


def compute_phase(
    services: dict[str, str],
    score: float | None,
    threshold: float,
    events: list[dict],
    after_window_sec: int,
    now: datetime | None = None,
) -> str:
    """AVANT (before) / PENDANT (during) / APRÈS (after) l'incident."""
    now = now or datetime.now(timezone.utc)
    last = events[0] if events else None  # le journal est trié du plus récent au plus ancien

    if (
        any(state == "ko" for state in services.values())
        or (score is not None and score > threshold)
        or (last is not None and last.get("status") in INCIDENT_EVENT_STATUSES)
    ):
        return "during"

    if last is not None and last.get("status") == "recovered":
        try:
            ts = datetime.fromisoformat(last["ts"])
            if (now - ts).total_seconds() < after_window_sec:
                return "after"
        except (KeyError, ValueError, TypeError):
            pass
    return "before"
