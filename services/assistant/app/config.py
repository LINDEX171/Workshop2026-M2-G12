from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "assistant"
    log_level: str = "INFO"

    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:3b"       # LLM de réponse (<= 8 Md de paramètres)
    embed_model: str = "nomic-embed-text"  # modèle d'embeddings

    # Documentation indexée (montée en lecture seule) et base vectorielle.
    # Chroma dans /tmp (tmpfs) : inscriptible par appuser en conteneur read_only.
    # Reconstruite au démarrage (réindexation), donc pas besoin de volume persistant.
    knowledge_dir: str = "/app/knowledge"
    chroma_dir: str = "/tmp/chroma"

    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 4


@lru_cache
def get_settings() -> Settings:
    return Settings()
