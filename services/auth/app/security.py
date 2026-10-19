from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        # Temps de réponse constant, que l'utilisateur existe ou non
        pwd_context.dummy_verify()
        return False
    return pwd_context.verify(password, password_hash)


def create_token(username: str, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    claims = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=s.jwt_expire_min),
    }
    return jwt.encode(claims, s.jwt_secret.get_secret_value(), algorithm=s.jwt_alg)


def decode_token(token: str) -> dict:
    """Lève jwt.InvalidTokenError si le token est invalide ou expiré."""
    s = get_settings()
    return jwt.decode(
        token,
        s.jwt_secret.get_secret_value(),
        algorithms=[s.jwt_alg],
        options={"require": ["sub", "role", "exp"]},
    )
