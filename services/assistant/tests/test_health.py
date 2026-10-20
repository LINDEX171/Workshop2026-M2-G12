from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


async def _ready():
    return True


async def _down():
    return False


def test_health_ok(monkeypatch):
    monkeypatch.setattr(main, "ollama_ready", _ready)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["deps"]["ollama"] == "ok"


def test_health_ollama_down(monkeypatch):
    monkeypatch.setattr(main, "ollama_ready", _down)
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["deps"]["ollama"] == "ko"


def test_ask_requires_auth():
    assert client.post("/ask", json={"question": "Comment remédier à un DoS ?"}).status_code == 401


def test_ask_requires_index(monkeypatch):
    main.assistant.indexed = 0
    app.dependency_overrides[main.require_token] = lambda: {"sub": "operator", "role": "operator"}
    try:
        r = client.post("/ask", json={"question": "Comment remédier à un DoS ?"})
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 503


def test_ask_too_short():
    app.dependency_overrides[main.require_token] = lambda: {"sub": "operator", "role": "operator"}
    try:
        r = client.post("/ask", json={"question": "a"})
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 422


def test_metrics():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "assistant_ask_total" in r.text
