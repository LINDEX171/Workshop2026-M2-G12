"""Boucle de détection : features Prometheus -> score -> alerte au remediator."""
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import structlog
from prometheus_client import Counter, Gauge

from app.config import Settings
from app.features import fetch_current
from app.model import Detector

log = structlog.get_logger()

ANOMALY_SCORE = Gauge("anomaly_score", "Score d'anomalie courant (0 = normal, 1 = très anormal)")
ANOMALY_THRESHOLD = Gauge("anomaly_threshold", "Seuil d'alerte en vigueur (calibré ou forcé)")
ANOMALY_COMPONENT = Gauge("anomaly_component_score", "Composantes du score", ["component"])
ANOMALY_DETECTED = Counter("anomaly_detected_total", "Alertes d'anomalie envoyées au remediator", ["type"])
FEATURE_VALUE = Gauge("detector_feature", "Valeur courante d'une feature de détection", ["feature"])


def alert_type(features: dict[str, float]) -> str:
    return "service_down" if features.get("up", 1) < 0.5 else "availability_dos"


class Engine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.detector: Detector | None = None
        self._model_mtime: float | None = None
        self.last: dict = {"score": None, "components": {}, "features": {}, "top_features": [], "updated_at": None}
        self._last_alert = 0.0

    @property
    def threshold(self) -> float:
        """Seuil forcé dans la config, sinon seuil calibré du modèle, sinon valeur par défaut."""
        configured = self.settings.detector_threshold.strip().lower()
        if configured != "auto":
            return float(configured)
        if self.detector is not None and "threshold" in self.detector.meta:
            return float(self.detector.meta["threshold"])
        return self.settings.default_threshold

    def maybe_reload(self) -> None:
        """Charge le modèle au démarrage et le recharge à chaud après un réentraînement."""
        path = Path(self.settings.model_path)
        if not path.exists():
            return
        mtime = path.stat().st_mtime
        if mtime == self._model_mtime:
            return
        try:
            self.detector = Detector.load(path)
            self._model_mtime = mtime
            log.info("model_loaded", path=str(path), trained_at=self.detector.meta.get("trained_at"))
        except Exception as exc:  # fichier en cours d'écriture, version incompatible...
            log.error("model_load_failed", error=str(exc))

    async def tick(self, client: httpx.AsyncClient) -> None:
        self.maybe_reload()
        features = await fetch_current(client, self.settings.prometheus_url)
        for name, value in features.items():
            FEATURE_VALUE.labels(feature=name).set(value)

        score = top = None
        components: dict[str, float] = {}
        threshold = self.threshold
        ANOMALY_THRESHOLD.set(threshold)
        if self.detector is not None:
            result = self.detector.anomaly(features, threshold)
            score = result["score"]
            components = {"isolation_forest": result["if_score"], "envelope": result["envelope_score"]}
            top = self.detector.top_features(features)
            ANOMALY_SCORE.set(score)
            for name, value in components.items():
                ANOMALY_COMPONENT.labels(component=name).set(value)

        self.last = {
            "score": None if score is None else round(score, 4),
            "components": {k: round(v, 4) for k, v in components.items()},
            "features": {k: round(v, 4) for k, v in features.items()},
            "top_features": top or [],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if score is not None and score > threshold:
            await self.alert(client, score, threshold, features, top, components)

    async def alert(
        self,
        client: httpx.AsyncClient,
        score: float,
        threshold: float,
        features: dict,
        top: list,
        components: dict | None = None,
    ) -> None:
        now = time.monotonic()
        if now - self._last_alert < self.settings.alert_cooldown_sec:
            return  # une alerte est déjà partie récemment : on laisse la remédiation agir
        self._last_alert = now

        kind = alert_type(features)
        payload = {
            "type": kind,
            "target": "payment-api",
            "score": round(score, 4),
            "threshold": threshold,
            "components": {k: round(v, 4) for k, v in (components or {}).items()},
            "evidence": {
                "p95": round(features["p95_latency"], 3),
                "err_rate": round(features["err_ratio"], 3),
                "req_rate": round(features["req_rate"], 2),
                "cpu": round(features["cpu"], 3),
            },
            "top_features": top,
        }
        ANOMALY_DETECTED.labels(type=kind).inc()
        log.warning("anomaly_detected", **payload)
        try:
            r = await client.post(f"{self.settings.remediator_url}/alert", json=payload)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            log.error("alert_send_failed", error=str(exc))
