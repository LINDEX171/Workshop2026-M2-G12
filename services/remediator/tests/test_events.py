from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def test_events_empty():
    r = client.get("/events")
    assert r.status_code == 200
    assert r.json() == []


def test_alert_from_alertmanager():
    payload = {
        "status": "firing",
        "alerts": [{"status": "firing", "labels": {"alertname": "PaymentApiDown", "type": "service_down", "target": "payment-api"}}],
    }
    r = client.post("/alert", json=payload)
    assert r.status_code == 202


def test_alert_from_detector():
    payload = {"type": "availability_dos", "target": "payment-api", "score": 0.82, "evidence": {"p95": 4.1}}
    r = client.post("/alert", json=payload)
    assert r.status_code == 202


def test_events_newest_first(monkeypatch):
    monkeypatch.setattr(main, "EVENTS", [{"ts": "1", "status": "running"}, {"ts": "2", "status": "recovered"}])
    r = client.get("/events", params={"limit": 1})
    assert r.json() == [{"ts": "2", "status": "recovered"}]
