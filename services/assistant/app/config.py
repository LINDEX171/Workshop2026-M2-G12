from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "assistant"
    log_level: str = "INFO"
    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:3b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
