from fastapi.testclient import TestClient

from app import main
from app.main import app, normalize

client = TestClient(app)


def test_normalize_detector():
    payload = {"type": "availability_dos", "target": "payment-api", "score": 0.82}
    incidents = normalize(payload)
    assert incidents == [
        {"type": "availability_dos", "target": "payment-api", "source": "detector", "score": 0.82}
    ]


def test_normalize_alertmanager_firing_only():
    payload = {
        "alerts": [
            {"status": "firing", "labels": {"type": "service_down", "target": "payment-api"}},
            {"status": "resolved", "labels": {"type": "service_down", "target": "payment-api"}},
        ]
    }
    incidents = normalize(payload)
    assert len(incidents) == 1
    assert incidents[0]["type"] == "service_down"
    assert incidents[0]["source"] == "alertmanager"


def test_alert_schedules_remediation(monkeypatch):
    calls = []

    async def fake_handle(incident):
        calls.append(incident)

    monkeypatch.setattr(main.remediator, "handle", fake_handle)
    r = client.post("/alert", json={"type": "availability_dos", "target": "payment-api", "score": 0.9})
    assert r.status_code == 202
    assert r.json() == {"accepted": True, "incidents": 1}
    assert calls and calls[0]["type"] == "availability_dos"


def test_events_empty():
    main.remediator.events.clear()
    r = client.get("/events")
    assert r.status_code == 200
    assert r.json() == []


def test_health():
    assert client.get("/health").json()["service"] == "remediator"
