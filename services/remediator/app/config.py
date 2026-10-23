from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (jamais de valeur en dur)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", secrets_dir="/run/secrets")

    service_name: str = "remediator"
    log_level: str = "INFO"

    # Vérification de reprise : parcours complet via le WAF (preuve de bout en bout)
    waf_url: str = "https://waf:8443"
    payment_url: str = "http://payment-api:8000"
    operator_username: str = "operator"

    # Accès Docker restreint (lecture conteneurs + restart/kill), jamais le socket brut
    docker_proxy_url: str = "http://docker-socket-proxy:2375"
    compose_project: str = "resilience-g12"

    # Source pour identifier la signature de l'attaquant (top User-Agent des logs WAF)
    loki_url: str = "http://loki:3100"
    # UA du probe de reprise : exclu de l'identification, ne doit jamais être banni
    probe_user_agent: str = "ResilienceProbe/1.0"
    # Signatures légitimes à ne JAMAIS bannir (regex) : le load-generator (preuve de vie)
    # ET les navigateurs réels (Mozilla…) pour ne pas verrouiller un opérateur par erreur.
    signature_exclude_regex: str = "python-requests.*|Mozilla.*|.*curl.*"
    # Filet de sécurité si Loki n'a pas encore la donnée (fiabilité démo)
    fallback_attack_signature: str = "ResilienceDoS/1.0"

    # Playbooks Ansible (montés en lecture seule dans l'image)
    playbooks_dir: str = "/app/playbooks"
    waf_banlist_ip_dir: str = "/var/lib/waf-banlist"
    waf_banlist_ua_dir: str = "/var/lib/waf-banlist-ua"

    # Vérification de reprise : nombre d'essais et délai (le service vient de redémarrer)
    verify_attempts: int = 12
    verify_delay_sec: float = 2.0

    # --- Notifications e-mail (SOC / notification d'incident NIS2-DORA) ---
    # Best-effort : désactivé par défaut, n'impacte jamais la remédiation.
    # Gmail : smtp_host=smtp.gmail.com, port=587, use_tls=true, username=<adresse>.
    # Mailpit local (repli hors-ligne) : smtp_host=mailpit, port=1025, use_tls=false.
    notify_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: str = ""
    notify_from: str = ""   # défaut : smtp_username
    notify_to: str = ""     # destinataire des alertes

    # --- Secrets ---
    operator_password: SecretStr = SecretStr("")
    # Mot de passe d'application Gmail (vide = pas d'auth, ex. Mailpit). Via Docker secrets.
    smtp_password: SecretStr = SecretStr("")


@lru_cache
def get_settings() -> Settings:
    return Settings()
