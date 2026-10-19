from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def test_events_empty():
    r = client.get("/events")
    assert r.status_code == 200
    assert r.json() == []


def test_events_newest_first(monkeypatch):
    monkeypatch.setattr(main, "EVENTS", [{"ts": "1", "status": "running"}, {"ts": "2", "status": "recovered"}])
    r = client.get("/events", params={"limit": 1})
    assert r.json() == [{"ts": "2", "status": "recovered"}]
