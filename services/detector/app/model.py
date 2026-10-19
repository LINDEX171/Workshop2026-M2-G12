"""Modèle de détection appris sur du trafic normal : Isolation Forest + enveloppe statistique.

1. Isolation Forest (non supervisé) : score s(x) de Liu et al. (2008) = -score_samples(x),
   entre 0 et 1, ~0,5 ou moins pour un point normal. Il repère les combinaisons
   inhabituelles d'indicateurs, mais SATURE : il mesure la facilité d'isolement, pas
   l'ampleur du dépassement (120 écarts-types ou 3, presque le même score).
2. Enveloppe statistique : moyenne et dispersion de chaque indicateur en trafic normal.
   Elle mesure l'ampleur : si au moins ENVELOPE_MIN_FEATURES indicateurs s'écartent de
   plus de ENVELOPE_SIGMA dispersions, son score dépasse le seuil.

Score final = max(score Isolation Forest, score enveloppe). Les deux sont appris sur les
mêmes données de trafic normal ; aucun seuil métier n'est écrit à la main.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.features import FEATURE_NAMES

# Bruit ajouté à l'entraînement de l'Isolation Forest : 2 % de l'amplitude moyenne,
# avec un plancher. Sans lui, une feature constante en trafic normal (ex. 0 erreur 5xx,
# up = 1) ne serait jamais découpée par les arbres et son explosion resterait invisible.
JITTER_RATIO = 0.02
JITTER_FLOOR = 1e-3

# Seuil calibré = score Isolation Forest maximal observé sur le trafic normal + marge.
THRESHOLD_MARGIN = 0.05

# Enveloppe : dispersion de référence = max(écart-type observé, 25 % de la moyenne, plancher).
# Le plancher relatif évite qu'un indicateur très stable en normal (ex. toujours 4
# connexions DB) déclenche sur la moindre variation légitime.
ENVELOPE_REL_FLOOR = 0.25
ENVELOPE_ABS_FLOOR = 1e-3
ENVELOPE_SIGMA = 6.0
ENVELOPE_MIN_FEATURES = 2


@dataclass
class Detector:
    model: IsolationForest
    scaler: StandardScaler
    features: list[str]
    mean: dict[str, float]   # moyenne en trafic normal (données brutes)
    scale: dict[str, float]  # dispersion de référence de l'enveloppe
    meta: dict = field(default_factory=dict)

    def _matrix(self, rows: list[dict[str, float]]) -> np.ndarray:
        return np.array([[row[f] for f in self.features] for row in rows], dtype=float)

    # --- Isolation Forest ---
    def scores(self, rows: list[dict[str, float]]) -> np.ndarray:
        return -self.model.score_samples(self.scaler.transform(self._matrix(rows)))

    def score(self, row: dict[str, float]) -> float:
        return float(self.scores([row])[0])

    # --- Enveloppe statistique ---
    def deviations(self, row: dict[str, float]) -> dict[str, float]:
        """Écart de chaque indicateur au trafic normal, en nombre de dispersions (signé)."""
        return {f: (row[f] - self.mean[f]) / self.scale[f] for f in self.features}

    def envelope_score(self, row: dict[str, float], threshold: float) -> float:
        """0 tant que moins de ENVELOPE_MIN_FEATURES indicateurs dépassent ENVELOPE_SIGMA ;
        au-delà, croît de `threshold` vers 1 avec l'ampleur de l'écart."""
        ranked = sorted((abs(d) for d in self.deviations(row).values()), reverse=True)
        d = ranked[ENVELOPE_MIN_FEATURES - 1]
        if d <= ENVELOPE_SIGMA:
            return 0.0
        return threshold + (1 - threshold) * (1 - math.exp(-(d - ENVELOPE_SIGMA) / ENVELOPE_SIGMA))

    # --- Combinaison ---
    def anomaly(self, row: dict[str, float], threshold: float) -> dict[str, float]:
        if_score = self.score(row)
        env_score = self.envelope_score(row, threshold)
        return {"score": max(if_score, env_score), "if_score": if_score, "envelope_score": env_score}

    def top_features(self, row: dict[str, float], n: int = 3) -> list[dict]:
        """Explication : indicateurs les plus éloignés du trafic normal."""
        dev = self.deviations(row)
        ranked = sorted(dev, key=lambda f: abs(dev[f]), reverse=True)[:n]
        return [{"feature": f, "value": round(row[f], 4), "zscore": round(dev[f], 1)} for f in ranked]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

    @staticmethod
    def load(path: Path) -> "Detector":
        detector = joblib.load(path)
        if not hasattr(detector, "scale"):
            raise ValueError("Modèle d'une version précédente : relancer scripts/train_model.sh --no-wait")
        return detector


def train(
    rows: list[dict[str, float]],
    n_estimators: int = 200,
    max_samples: int | str = "auto",
    seed: int = 42,
) -> Detector:
    if len(rows) < 30:
        raise ValueError(f"Pas assez de données pour entraîner ({len(rows)} lignes, 30 minimum)")

    X = np.array([[row[f] for f in FEATURE_NAMES] for row in rows], dtype=float)
    rng = np.random.default_rng(seed)
    noise = np.maximum(np.abs(X).mean(axis=0) * JITTER_RATIO, JITTER_FLOOR)
    X_train = X + rng.normal(0.0, noise, X.shape)

    scaler = StandardScaler().fit(X_train)
    model = IsolationForest(
        n_estimators=n_estimators, max_samples=max_samples, contamination="auto", random_state=seed
    )
    model.fit(scaler.transform(X_train))

    mean = X.mean(axis=0)
    scale = np.maximum.reduce([X.std(axis=0), np.abs(mean) * ENVELOPE_REL_FLOOR,
                               np.full(len(FEATURE_NAMES), ENVELOPE_ABS_FLOOR)])

    detector = Detector(
        model=model,
        scaler=scaler,
        features=list(FEATURE_NAMES),
        mean=dict(zip(FEATURE_NAMES, mean.round(6).tolist())),
        scale=dict(zip(FEATURE_NAMES, scale.round(6).tolist())),
    )
    train_scores = detector.scores(rows)
    threshold = round(float(train_scores.max()) + THRESHOLD_MARGIN, 3)
    # Contrôle : l'enveloppe ne doit (presque) jamais se déclencher sur le trafic normal
    envelope_false_alerts = sum(detector.envelope_score(r, threshold) > 0 for r in rows)
    detector.meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(rows),
        "n_estimators": n_estimators,
        "threshold": threshold,
        "envelope": {"sigma": ENVELOPE_SIGMA, "min_features": ENVELOPE_MIN_FEATURES,
                     "rel_floor": ENVELOPE_REL_FLOOR, "false_alerts_on_train": envelope_false_alerts},
        "score_train": {
            "p50": round(float(np.percentile(train_scores, 50)), 4),
            "p95": round(float(np.percentile(train_scores, 95)), 4),
            "p99": round(float(np.percentile(train_scores, 99)), 4),
            "max": round(float(train_scores.max()), 4),
        },
        "feature_stats": {
            f: {
                "min": round(float(X[:, i].min()), 4),
                "mean": round(float(mean[i]), 4),
                "max": round(float(X[:, i].max()), 4),
                "scale": round(float(scale[i]), 4),
            }
            for i, f in enumerate(FEATURE_NAMES)
        },
    }
    return detector
