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

    # Validation des jetons : l'assistant n'est pas public
    auth_url: str = "http://auth:8000"

    # Documentation indexée (montée en lecture seule) et base vectorielle.
    # Chroma dans /tmp (tmpfs) : inscriptible par appuser en conteneur read_only.
    # Reconstruite au démarrage (réindexation), donc pas besoin de volume persistant.
    knowledge_dir: str = "/app/knowledge"
    chroma_dir: str = "/tmp/chroma"

    # Réglages de latence (CPU sans GPU) : prompt court + réponse bornée -> ~5 s.
    chunk_size: int = 500
    chunk_overlap: int = 80
    top_k: int = 3
    history_turns: int = 2      # échanges précédents gardés dans le prompt
    num_predict: int = 160      # longueur max de la réponse (tokens)
    num_ctx: int = 2048         # fenêtre de contexte (plus petite = plus rapide)
    keep_alive: int = -1        # garde le modèle chargé en RAM (pas de rechargement à froid)


@lru_cache
def get_settings() -> Settings:
    return Settings()
