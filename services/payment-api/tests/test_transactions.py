from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app, require_token

client = TestClient(app)


@pytest.fixture
def authenticated():
    app.dependency_overrides[require_token] = lambda: {"sub": "operator", "role": "operator"}
    yield
    app.dependency_overrides.clear()


def fake_transfer(status):
    def _transfer(src, dst, amount):
        return {
            "id": 42,
            "src": src,
            "dst": dst,
            "amount": amount,
            "status": status,
            "created_at": datetime.now(timezone.utc),
        }

    return _transfer


def test_transaction_without_token_is_401():
    r = client.post("/transactions", json={"dst": 2, "amount": 10})
    assert r.status_code == 401


def test_transaction_accepted_with_token(authenticated, monkeypatch):
    monkeypatch.setattr(db, "create_transfer", fake_transfer("accepted"))
    r = client.post("/transactions", json={"dst": 2, "amount": 10})
    assert r.status_code == 200
    assert r.json() == {"id": 42, "status": "accepted"}


def test_transaction_insufficient_funds(authenticated, monkeypatch):
    monkeypatch.setattr(db, "create_transfer", fake_transfer("rejected"))
    r = client.post("/transactions", json={"dst": 2, "amount": 999999})
    assert r.status_code == 422
    assert r.json()["status"] == "rejected"


def test_transaction_same_account(authenticated):
    r = client.post("/transactions", json={"src": 2, "dst": 2, "amount": 10})
    assert r.status_code == 422


def test_transaction_negative_amount(authenticated):
    r = client.post("/transactions", json={"dst": 2, "amount": -5})
    assert r.status_code == 422


def test_transaction_unknown_account(authenticated, monkeypatch):
    def missing(*_):
        raise db.AccountNotFound()

    monkeypatch.setattr(db, "create_transfer", missing)
    r = client.post("/transactions", json={"dst": 99, "amount": 10})
    assert r.status_code == 404


def test_list_accounts(authenticated, monkeypatch):
    monkeypatch.setattr(
        db, "list_accounts", lambda: [{"id": 1, "owner": "Alice", "balance": Decimal("1000.00")}]
    )
    r = client.get("/accounts")
    assert r.status_code == 200
    assert r.json()[0]["owner"] == "Alice"


def test_list_accounts_without_token_is_401():
    assert client.get("/accounts").status_code == 401
