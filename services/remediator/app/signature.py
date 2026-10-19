"""Identification de la signature de l'attaquant à partir des logs d'accès du WAF (Loki).

Derrière Docker Desktop, l'IP source réelle des clients n'est pas visible du WAF
(tous vus depuis la passerelle Docker). On bannit donc la *signature* (User-Agent)
du plus gros émetteur de requêtes observé sur le WAF, pas l'IP. En cas d'indisponibilité
de Loki, on retombe sur une signature connue (fiabilité de la démo).
"""
import httpx
import structlog

from app.config import Settings

log = structlog.get_logger()


async def top_attacker_signature(client: httpx.AsyncClient, settings: Settings) -> tuple[str, str]:
    """(signature, source) : le User-Agent le plus émetteur sur le WAF (2 dernières minutes).

    `source` vaut "loki" si identifié depuis les logs, "fallback" sinon.
    """
    # Exclut le probe de reprise et le trafic légitime (load-generator) de l'identification
    query = (
        'topk(1, sum by (ua) (count_over_time('
        '{service="waf"} | json | log_type="access" '
        '| ua != "" | ua != "%s" | ua !~ "%s" [2m])))'
        % (settings.probe_user_agent, settings.signature_exclude_regex)
    )
    try:
        r = await client.get(f"{settings.loki_url}/loki/api/v1/query", params={"query": query})
        r.raise_for_status()
        result = r.json()["data"]["result"]
        if result:
            ua = result[0]["metric"].get("ua", "").strip()
            if ua:
                return ua, "loki"
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        log.warning("loki_signature_lookup_failed", error=str(exc))
    return settings.fallback_attack_signature, "fallback"
