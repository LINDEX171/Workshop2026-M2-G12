"""Vérification de reprise : rejoue une vraie transaction via le WAF et relit /health.

C'est la preuve de la reprise exigée par le sujet : on ne déclare `recovered` que si
une transaction authentifiée aboutit (200) ET que payment-api se dit lui-même sain.
Le parcours passe par le WAF (chemin complet), avec un User-Agent de probe dédié
exclu du bannissement.
"""
import asyncio

import httpx
import structlog

from app.config import Settings

log = structlog.get_logger()


async def _login(client: httpx.AsyncClient, settings: Settings) -> str | None:
    r = await client.post(
        f"{settings.waf_url}/api/auth/login",
        json={
            "username": settings.operator_username,
            "password": settings.operator_password.get_secret_value(),
        },
    )
    return r.json().get("token") if r.status_code == 200 else None


async def _probe_once(client: httpx.AsyncClient, settings: Settings, token: str) -> dict:
    tx = await client.post(
        f"{settings.waf_url}/api/pay/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={"src": 1, "dst": 2, "amount": 1},
    )
    if tx.status_code == 401:
        return {"ok": False, "reason": "token_rejected", "relogin": True}
    tx_ok = tx.status_code == 200 and tx.json().get("status") == "accepted"

    health = await client.get(f"{settings.payment_url}/health")
    health_ok = health.status_code == 200

    return {
        "ok": tx_ok and health_ok,
        "reason": "ok" if tx_ok and health_ok else f"tx={tx.status_code} health={health.status_code}",
        "tx_id": tx.json().get("id") if tx_ok else None,
    }


async def verify_recovery(settings: Settings) -> dict:
    """Essaie la transaction de preuve jusqu'à `verify_attempts` fois (service en warm-up).

    Un seul login est effectué (réémis uniquement si le token est rejeté) pour ne pas
    déclencher la limite anti brute force du WAF.
    """
    headers = {"User-Agent": settings.probe_user_agent}
    async with httpx.AsyncClient(timeout=5.0, verify=False, headers=headers) as client:
        token: str | None = None
        last = {"ok": False, "reason": "no_attempt"}
        for attempt in range(1, settings.verify_attempts + 1):
            try:
                if token is None:
                    token = await _login(client, settings)
                if token is None:
                    last = {"ok": False, "reason": "login_failed"}
                else:
                    last = await _probe_once(client, settings, token)
                    if last.get("relogin"):
                        token = None
            except httpx.HTTPError as exc:
                last = {"ok": False, "reason": f"unreachable: {exc}"}
            if last["ok"]:
                log.info("recovery_verified", attempt=attempt, tx_id=last.get("tx_id"))
                return {**last, "attempts": attempt}
            await asyncio.sleep(settings.verify_delay_sec)
        log.warning("recovery_not_verified", reason=last["reason"])
        return {**last, "attempts": settings.verify_attempts}
