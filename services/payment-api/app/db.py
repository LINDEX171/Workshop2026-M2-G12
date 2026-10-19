from decimal import Decimal
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine

from app.config import get_settings

TX_COLUMNS = "id, src, dst, amount, status, created_at"


class AccountNotFound(Exception):
    pass


@lru_cache
def get_engine() -> Engine:
    s = get_settings()
    url = URL.create(
        "postgresql+psycopg",
        username=s.db_user,
        password=s.payuser_password.get_secret_value(),
        host=s.db_host,
        port=s.db_port,
        database=s.db_name,
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=10,
        pool_timeout=2,
        connect_args={"connect_timeout": 2, "options": "-c search_path=payments"},
    )


def ping() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def list_accounts() -> list[dict]:
    with get_engine().connect() as conn:
        rows = conn.execute(text("SELECT id, owner, balance FROM accounts ORDER BY id"))
        return [dict(r._mapping) for r in rows]


def list_transactions(limit: int) -> list[dict]:
    with get_engine().connect() as conn:
        rows = conn.execute(
            text(f"SELECT {TX_COLUMNS} FROM transactions ORDER BY id DESC LIMIT :n"),
            {"n": limit},
        )
        return [dict(r._mapping) for r in rows]


def get_transaction(tx_id: int) -> dict | None:
    with get_engine().connect() as conn:
        row = conn.execute(
            text(f"SELECT {TX_COLUMNS} FROM transactions WHERE id = :id"), {"id": tx_id}
        ).first()
    return dict(row._mapping) if row else None


def create_transfer(src: int, dst: int, amount: Decimal) -> dict:
    """Virement atomique : débit + crédit + journalisation dans une seule transaction SQL.

    Les deux comptes sont verrouillés (ordre croissant d'id, pas d'interblocage).
    Solde insuffisant -> transaction journalisée avec le statut `rejected`.
    """
    with get_engine().begin() as conn:
        rows = conn.execute(
            text("SELECT id, balance FROM accounts WHERE id IN (:a, :b) ORDER BY id FOR UPDATE"),
            {"a": src, "b": dst},
        ).all()
        balances = {r.id: r.balance for r in rows}
        if src not in balances or dst not in balances:
            raise AccountNotFound()

        status = "accepted" if balances[src] >= amount else "rejected"
        if status == "accepted":
            conn.execute(
                text("UPDATE accounts SET balance = balance - :amt WHERE id = :id"),
                {"amt": amount, "id": src},
            )
            conn.execute(
                text("UPDATE accounts SET balance = balance + :amt WHERE id = :id"),
                {"amt": amount, "id": dst},
            )
        row = conn.execute(
            text(
                "INSERT INTO transactions (src, dst, amount, status) "
                f"VALUES (:src, :dst, :amt, :status) RETURNING {TX_COLUMNS}"
            ),
            {"src": src, "dst": dst, "amt": amount, "status": status},
        ).one()
    return dict(row._mapping)
