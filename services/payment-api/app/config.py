from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur).

    Les secrets sont lus depuis /run/secrets/<nom_du_champ> (secrets Docker).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", secrets_dir="/run/secrets")

    service_name: str = "payment-api"
    log_level: str = "INFO"
    auth_url: str = "http://auth:8000"

    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "payments"
    db_user: str = "payuser"

    # Compte débité quand la requête ne précise pas `src`
    default_src_account: int = 1

    # --- Secrets ---
    payuser_password: SecretStr = SecretStr("")


@lru_cache
def get_settings() -> Settings:
    return Settings()
