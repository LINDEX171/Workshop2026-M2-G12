from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    s = get_settings()
    url = URL.create(
        "postgresql+psycopg",
        username=s.auth_db_user,
        password=s.authuser_password.get_secret_value(),
        host=s.auth_db_host,
        port=s.auth_db_port,
        database=s.auth_db_name,
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=2,
        connect_args={"connect_timeout": 2, "options": "-c search_path=auth"},
    )


def ping() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_user(username: str) -> dict | None:
    with get_engine().connect() as conn:
        row = conn.execute(
            text("SELECT id, username, password_hash, role FROM users WHERE username = :u"),
            {"u": username},
        ).first()
    return dict(row._mapping) if row else None


def ensure_user(username: str, password_hash: str, role: str) -> bool:
    """Crée l'utilisateur s'il n'existe pas. Renvoie True si créé."""
    with get_engine().begin() as conn:
        row = conn.execute(
            text(
                "INSERT INTO users (username, password_hash, role) VALUES (:u, :h, :r) "
                "ON CONFLICT (username) DO NOTHING RETURNING id"
            ),
            {"u": username, "h": password_hash, "r": role},
        ).first()
    return row is not None
