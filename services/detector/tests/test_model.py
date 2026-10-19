import numpy as np
import pytest

from app.features import FEATURE_NAMES, clean, first_value
from app.model import Detector, train


def normal_rows(n=300, seed=0):
    rng = np.random.default_rng(seed)
    return [
        {
            "req_rate": rng.normal(2.5, 0.3),
            "err_ratio": 0.0,
            "p95_latency": abs(rng.normal(0.03, 0.005)),
            "cpu": abs(rng.normal(0.02, 0.005)),
            "ram_mb": rng.normal(80, 1),
            "db_active": float(rng.integers(0, 2)),
            "tx_fail_ratio": 0.0,
            "up": 1.0,
        }
        for _ in range(n)
    ]


@pytest.fixture(scope="module")
def detector():
    return train(normal_rows())


def combined(detector, row):
    return detector.anomaly(row, detector.meta["threshold"])["score"]


def test_normal_traffic_scores_below_threshold(detector):
    rows = normal_rows(500, seed=1)
    assert np.median(detector.scores(rows)) < 0.5
    # ni l'Isolation Forest ni l'enveloppe ne déclenchent sur du trafic normal
    assert max(combined(detector, r) for r in rows) < detector.meta["threshold"]
    assert detector.meta["envelope"]["false_alerts_on_train"] == 0


def test_dos_scores_above_threshold(detector):
    dos = {**normal_rows(1)[0], "req_rate": 120.0, "p95_latency": 4.0, "err_ratio": 0.35, "cpu": 0.9,
           "db_active": 8.0, "tx_fail_ratio": 0.2}
    assert combined(detector, dos) > detector.meta["threshold"]


def test_saturated_isolation_forest_caught_by_envelope(detector):
    # Cas mesuré sur la plateforme (300 utilisateurs) : Isolation Forest à 0,506 < seuil,
    # alors que req/s, connexions DB et CPU sont à des dizaines d'écarts-types du normal
    load = {**normal_rows(1)[0], "req_rate": 109.0, "db_active": 6.0, "cpu": 0.79, "p95_latency": 0.24}
    result = detector.anomaly(load, detector.meta["threshold"])
    assert result["envelope_score"] > detector.meta["threshold"]
    assert result["score"] > detector.meta["threshold"]


def test_single_indicator_does_not_trigger_envelope(detector):
    # Une seule requête lente : pas d'alerte de l'enveloppe (2 indicateurs requis)
    row = {**normal_rows(1)[0], "p95_latency": 2.0}
    assert detector.envelope_score(row, detector.meta["threshold"]) == 0.0


def test_service_down_scores_above_threshold(detector):
    down = {name: 0.0 for name in FEATURE_NAMES}
    assert combined(detector, down) > detector.meta["threshold"]


def test_constant_feature_still_detected(detector):
    # err_ratio vaut toujours 0 en trafic normal : le bruit d'entraînement doit permettre
    # de détecter son explosion
    row = {**normal_rows(1, seed=2)[0], "err_ratio": 0.5}
    assert detector.score(row) > detector.score(normal_rows(1, seed=2)[0])


def test_top_features_explains_anomaly(detector):
    row = {**normal_rows(1)[0], "p95_latency": 5.0}
    assert detector.top_features(row)[0]["feature"] == "p95_latency"


def test_train_requires_enough_data():
    with pytest.raises(ValueError):
        train(normal_rows(10))


def test_save_and_load(detector, tmp_path):
    path = tmp_path / "model.pkl"
    detector.save(path)
    loaded = Detector.load(path)
    row = normal_rows(1)[0]
    assert loaded.score(row) == pytest.approx(detector.score(row))


def test_clean_values():
    assert clean("NaN") == 0.0
    assert clean("+Inf") == 0.0
    assert clean(None) == 0.0
    assert clean("1.5") == 1.5
    assert first_value([]) == 0.0
    assert first_value([{"value": [0, "2"]}]) == 2.0
