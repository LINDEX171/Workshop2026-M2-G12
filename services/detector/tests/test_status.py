from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app import status
from app.main import app

client = TestClient(app)

ALL_OK = {"auth": "ok", "payment-api": "ok", "db": "ok"}
NOW = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)


def phase(services=ALL_OK, score=None, events=(), now=NOW):
    return status.compute_phase(services, score, 0.65, list(events), 300, now)


def test_phase_before_when_all_ok():
    assert phase() == "before"


def test_phase_during_when_service_ko():
    assert phase(services={**ALL_OK, "payment-api": "ko"}) == "during"


def test_phase_during_when_score_above_threshold():
    assert phase(score=0.9) == "during"


def test_phase_during_when_remediation_running():
    assert phase(events=[{"ts": NOW.isoformat(), "status": "running"}]) == "during"


def test_phase_after_recent_recovery():
    ts = (NOW - timedelta(seconds=60)).isoformat()
    assert phase(events=[{"ts": ts, "status": "recovered"}]) == "after"


def test_phase_back_to_before_after_window():
    ts = (NOW - timedelta(seconds=600)).isoformat()
    assert phase(events=[{"ts": ts, "status": "recovered"}]) == "before"


def test_dep_state():
    assert status.dep_state(True, {"deps": {"db": "ok"}}, "db") == "ok"
    assert status.dep_state(False, {}, "db") == "unknown"


def test_score_endpoint():
    r = client.get("/score")
    assert r.status_code == 200
    assert isinstance(r.json()["threshold"], float)


def test_status_requires_auth():
    assert client.get("/status").status_code == 401


def test_status_endpoint(monkeypatch):
    from app.main import require_token

    async def fake_services(client, urls):
        return {"detector": "ok", **{name: "ok" for name in urls}}

    async def fake_events(client, url, limit=20):
        return []

    monkeypatch.setattr(status, "collect_services", fake_services)
    monkeypatch.setattr(status, "fetch_events", fake_events)
    app.dependency_overrides[require_token] = lambda: {"sub": "operator", "role": "operator"}
    try:
        r = client.get("/status")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "before"
    assert body["services"]["payment-api"] == "ok"
    assert body["events"] == []
