from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur).

    Les secrets sont lus depuis /run/secrets/<nom_du_champ> (secrets Docker).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", secrets_dir="/run/secrets")

    service_name: str = "auth"
    log_level: str = "INFO"
    jwt_alg: str = "HS256"
    jwt_expire_min: int = 30

    auth_db_host: str = "auth-db"
    auth_db_port: int = 5432
    auth_db_name: str = "authdb"
    auth_db_user: str = "authuser"

    operator_username: str = "operator"
    admin_username: str = "admin"

    # --- Secrets ---
    authuser_password: SecretStr = SecretStr("")
    jwt_secret: SecretStr = SecretStr("")
    operator_password: SecretStr = SecretStr("")
    admin_password: SecretStr = SecretStr("")


@lru_cache
def get_settings() -> Settings:
    return Settings()
