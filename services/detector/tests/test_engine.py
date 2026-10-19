import asyncio

import httpx

from app import engine as engine_module
from app.config import Settings
from app.engine import Engine, alert_type


class FakeDetector:
    def __init__(self, score):
        self._score = score
        self.meta = {}

    def score(self, row):
        return self._score

    def anomaly(self, row, threshold):
        return {"score": self._score, "if_score": self._score, "envelope_score": 0.0}

    def top_features(self, row, n=3):
        return [{"feature": "p95_latency", "value": row["p95_latency"], "zscore": 42.0}]


class RecordingClient:
    def __init__(self):
        self.posts = []

    async def post(self, url, json=None):
        self.posts.append((url, json))
        return httpx.Response(202, request=httpx.Request("POST", url))


FEATURES = {
    "req_rate": 150.0, "err_ratio": 0.3, "p95_latency": 4.2, "cpu": 0.95,
    "ram_mb": 90.0, "db_active": 20.0, "tx_fail_ratio": 0.1, "up": 1.0,
}


def make_engine(monkeypatch, score, features=FEATURES):
    async def fake_fetch(client, url):
        return dict(features)

    monkeypatch.setattr(engine_module, "fetch_current", fake_fetch)
    eng = Engine(Settings(model_path="/inexistant/model.pkl", alert_cooldown_sec=60, detector_threshold="0.65"))
    eng.detector = FakeDetector(score)
    return eng


def test_alert_sent_above_threshold(monkeypatch):
    eng = make_engine(monkeypatch, score=0.82)
    client = RecordingClient()
    asyncio.run(eng.tick(client))
    assert len(client.posts) == 1
    url, payload = client.posts[0]
    assert url.endswith("/alert")
    assert payload["type"] == "availability_dos"
    assert payload["target"] == "payment-api"
    assert payload["evidence"]["p95"] == 4.2
    assert payload["top_features"][0]["feature"] == "p95_latency"


def test_no_alert_below_threshold(monkeypatch):
    eng = make_engine(monkeypatch, score=0.40)
    client = RecordingClient()
    asyncio.run(eng.tick(client))
    assert client.posts == []
    assert eng.last["score"] == 0.4


def test_cooldown_prevents_alert_storm(monkeypatch):
    eng = make_engine(monkeypatch, score=0.9)
    client = RecordingClient()
    asyncio.run(eng.tick(client))
    asyncio.run(eng.tick(client))
    assert len(client.posts) == 1


def test_no_model_means_no_score(monkeypatch):
    eng = make_engine(monkeypatch, score=0.9)
    eng.detector = None
    client = RecordingClient()
    asyncio.run(eng.tick(client))
    assert eng.last["score"] is None
    assert client.posts == []


def test_threshold_auto_uses_calibrated_value():
    eng = Engine(Settings(model_path="/inexistant/model.pkl", detector_threshold="auto", default_threshold=0.6))
    assert eng.threshold == 0.6  # pas encore de modèle
    eng.detector = FakeDetector(0.5)
    eng.detector.meta = {"threshold": 0.574}
    assert eng.threshold == 0.574


def test_threshold_forced_value():
    eng = Engine(Settings(model_path="/inexistant/model.pkl", detector_threshold="0.7"))
    eng.detector = FakeDetector(0.5)
    eng.detector.meta = {"threshold": 0.574}
    assert eng.threshold == 0.7


def test_alert_type():
    assert alert_type({"up": 0.0}) == "service_down"
    assert alert_type({"up": 1.0}) == "availability_dos"
