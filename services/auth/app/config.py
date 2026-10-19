from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "auth"
    log_level: str = "INFO"
    jwt_alg: str = "HS256"
    jwt_expire_min: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
