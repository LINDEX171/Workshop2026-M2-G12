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

    # Services sondés par l'agrégateur /status (tableau de bord)
    auth_url: str = "http://auth:8000"
    payment_url: str = "http://payment-api:8000"
    assistant_url: str = "http://assistant:8000"
    # Durée pendant laquelle le bandeau reste sur « APRÈS » après une reprise
    status_after_window_sec: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
