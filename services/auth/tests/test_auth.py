from fastapi.testclient import TestClient

from app import db, security
from app.main import app

client = TestClient(app)

OPERATOR = {
    "id": 1,
    "username": "operator",
    "password_hash": security.hash_password("s3cret"),
    "role": "operator",
}


def fake_get_user(username):
    return OPERATOR if username == "operator" else None


def test_login_success_returns_valid_token(monkeypatch):
    monkeypatch.setattr(db, "get_user", fake_get_user)
    r = client.post("/login", json={"username": "operator", "password": "s3cret"})
    assert r.status_code == 200
    token = r.json()["token"]

    r = client.get("/verify", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["sub"] == "operator"
    assert r.json()["role"] == "operator"


def test_login_wrong_password(monkeypatch):
    monkeypatch.setattr(db, "get_user", fake_get_user)
    r = client.post("/login", json={"username": "operator", "password": "nope"})
    assert r.status_code == 401


def test_login_unknown_user(monkeypatch):
    monkeypatch.setattr(db, "get_user", fake_get_user)
    r = client.post("/login", json={"username": "ghost", "password": "s3cret"})
    assert r.status_code == 401


def test_verify_without_token():
    assert client.get("/verify").status_code == 401


def test_verify_with_forged_token():
    r = client.get("/verify", headers={"Authorization": "Bearer abc.def.ghi"})
    assert r.status_code == 401


def test_me():
    token = security.create_token("operator", "operator")
    r = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == {"username": "operator", "role": "operator"}
