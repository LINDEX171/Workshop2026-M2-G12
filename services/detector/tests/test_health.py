import httpx
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


class FakeClient:
    def __init__(self, status_code=None, error=False):
        self.status_code = status_code
        self.error = error

    async def get(self, url, **kwargs):
        if self.error:
            raise httpx.ConnectError("injoignable")
        return httpx.Response(self.status_code)


def test_health_ok(monkeypatch):
    monkeypatch.setattr(main, "http", lambda: FakeClient(200))
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "detector"
    assert body["deps"]["prometheus"] == "ok"
    assert body["deps"]["model"] in ("loaded", "missing")


def test_health_prometheus_down(monkeypatch):
    monkeypatch.setattr(main, "http", lambda: FakeClient(error=True))
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["deps"]["prometheus"] == "ko"


def test_metrics():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "anomaly_score" in r.text
