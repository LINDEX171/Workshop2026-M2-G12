from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "payment-api"
    log_level: str = "INFO"
    auth_url: str = "http://auth:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
