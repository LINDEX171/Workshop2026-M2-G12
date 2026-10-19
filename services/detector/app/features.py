"""Features de détection, lues dans Prometheus (fenêtre glissante de 1 min sur payment-api)."""
import asyncio
import math
import time

import httpx

_JOB = 'job="payment-api"'
_APP = 'handler!~"/metrics|/health"'

# Nom de feature -> requête PromQL. L'ordre fixe celui des colonnes du modèle.
FEATURES: dict[str, str] = {
    "req_rate": f"sum(rate(http_requests_total{{{_JOB},{_APP}}}[1m]))",
    "err_ratio": (
        f'(sum(rate(http_requests_total{{{_JOB},status="5xx"}}[1m])) or vector(0))'
        f" / clamp_min(sum(rate(http_requests_total{{{_JOB}}}[1m])), 0.001)"
    ),
    "p95_latency": (
        "histogram_quantile(0.95, sum by (le) "
        f"(rate(http_request_duration_highr_seconds_bucket{{{_JOB}}}[1m])))"
    ),
    "cpu": f"rate(process_cpu_seconds_total{{{_JOB}}}[1m])",
    "ram_mb": f"process_resident_memory_bytes{{{_JOB}}} / 1e6",
    # Requêtes SQL en cours (et non connexions ouvertes : le pool les garde même inactives)
    "db_active": 'sum(pg_stat_activity_count{datname="payments", state="active"}) or vector(0)',
    "tx_fail_ratio": "(sum(rate(tx_failed_total[1m])) or vector(0)) / clamp_min(sum(rate(tx_total[1m])), 0.001)",
    "up": f"up{{{_JOB}}}",
}
FEATURE_NAMES = list(FEATURES)


def clean(value: float | str | None) -> float:
    """Valeur absente, NaN ou infinie -> 0 (ex. latence sans trafic, service arrêté)."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    return v if math.isfinite(v) else 0.0


def first_value(result: list) -> float:
    return clean(result[0]["value"][1]) if result else 0.0


async def fetch_current(client: httpx.AsyncClient, prometheus_url: str) -> dict[str, float]:
    """Valeur instantanée de chaque feature (lève httpx.HTTPError si Prometheus est KO)."""

    async def one(name: str, query: str) -> tuple[str, float]:
        r = await client.get(f"{prometheus_url}/api/v1/query", params={"query": query})
        r.raise_for_status()
        return name, first_value(r.json()["data"]["result"])

    pairs = await asyncio.gather(*(one(n, q) for n, q in FEATURES.items()))
    return dict(pairs)


def fetch_history(prometheus_url: str, minutes: int, step: int) -> list[dict[str, float]]:
    """Historique des features sur les `minutes` dernières minutes (une ligne par pas)."""
    end = time.time()
    start = end - minutes * 60
    series: dict[str, dict[float, float]] = {}
    with httpx.Client(timeout=30) as client:
        for name, query in FEATURES.items():
            r = client.get(
                f"{prometheus_url}/api/v1/query_range",
                params={"query": query, "start": start, "end": end, "step": step},
            )
            r.raise_for_status()
            result = r.json()["data"]["result"]
            series[name] = {float(ts): clean(v) for ts, v in result[0]["values"]} if result else {}

    timestamps = sorted(set().union(*(s.keys() for s in series.values())))
    return [{"ts": ts, **{n: series[n].get(ts, 0.0) for n in FEATURE_NAMES}} for ts in timestamps]
