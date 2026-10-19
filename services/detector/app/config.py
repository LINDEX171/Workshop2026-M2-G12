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
    # "auto" : seuil calibré à l'entraînement (max du trafic normal + marge).
    # Une valeur numérique (ex. 0.6) force un seuil fixe.
    detector_threshold: str = "auto"
    # Seuil utilisé tant qu'aucun modèle calibré n'est chargé
    default_threshold: float = 0.6
    # Délai minimal entre deux alertes (laisse le temps à la remédiation d'agir)
    alert_cooldown_sec: int = 60
    # Modèle produit par `python -m app.train` (rechargé à chaud s'il change)
    model_path: str = "/app/model/model.pkl"

    # Services sondés par l'agrégateur /status (tableau de bord)
    auth_url: str = "http://auth:8000"
    payment_url: str = "http://payment-api:8000"
    assistant_url: str = "http://assistant:8000"
    # Durée pendant laquelle le bandeau reste sur « APRÈS » après une reprise
    status_after_window_sec: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
