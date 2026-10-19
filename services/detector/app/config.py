from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "detector"
    log_level: str = "INFO"
    prometheus_url: str = "http://prometheus:9090"
    remediator_url: str = "http://remediator:8000"
    detector_interval_sec: int = 10
    detector_threshold: float = 0.65


@lru_cache
def get_settings() -> Settings:
    return Settings()
