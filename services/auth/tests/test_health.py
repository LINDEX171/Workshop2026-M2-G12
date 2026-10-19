from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)


def test_health_ok(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: True)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "auth", "deps": {"db": "ok"}}


def test_health_db_down(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: False)
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["deps"]["db"] == "ko"


def test_metrics():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "auth_login_total" in r.text
