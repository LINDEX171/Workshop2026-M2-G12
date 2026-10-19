from fastapi.testclient import TestClient

from app import db, main
from app.main import app

client = TestClient(app)


async def auth_up():
    return True


async def auth_down():
    return False


def test_health_ok(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: True)
    monkeypatch.setattr(main, "check_auth", auth_up)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {
        "status": "ok",
        "service": "payment-api",
        "deps": {"db": "ok", "auth": "ok"},
    }


def test_health_auth_down(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: True)
    monkeypatch.setattr(main, "check_auth", auth_down)
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["deps"]["auth"] == "ko"


def test_metrics():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "tx_latency_seconds" in r.text
