"""Résolution service Compose -> id de conteneur, via le docker-socket-proxy (lecture seule).

Le remediator ne touche jamais le socket Docker directement : il passe par le proxy
Tecnativa qui n'autorise que la lecture des conteneurs et les POST restart/kill.
"""
import httpx

from app.config import get_settings


async def resolve_container_id(client: httpx.AsyncClient, service: str) -> str | None:
    """Id du conteneur du service Compose donné (ex. 'payment-api'), ou None."""
    s = get_settings()
    filters = (
        '{"label":["com.docker.compose.service=%s",'
        '"com.docker.compose.project=%s"]}' % (service, s.compose_project)
    )
    try:
        r = await client.get(
            f"{s.docker_proxy_url}/containers/json",
            params={"filters": filters, "all": "true"},
        )
        r.raise_for_status()
        containers = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    return containers[0]["Id"] if containers else None
