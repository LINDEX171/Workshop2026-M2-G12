"""Moteur de remédiation Zero-Touch : décide, agit via Ansible, vérifie la reprise.

Flux d'un incident (journalisé dans EVENTS, repris par le dashboard) :
  detected -> running -> (playbooks) -> recovered | escalated
"""
import asyncio
from datetime import datetime, timezone

import httpx
import structlog
from fastapi.concurrency import run_in_threadpool
from prometheus_client import Counter, Histogram

from app import ansible, docker_api, notify, signature, verify
from app.config import Settings

log = structlog.get_logger()

REMEDIATION_TOTAL = Counter("remediation_total", "Remédiations déclenchées", ["type"])
REMEDIATION_SUCCESS = Counter("remediation_success_total", "Remédiations réussies", ["type"])
REMEDIATION_DURATION = Histogram(
    "remediation_duration_seconds", "Durée bout-en-bout d'une remédiation",
    buckets=(1, 2, 5, 10, 20, 30, 60, 120),
)

# Table de décision : type d'incident -> séquence d'actions (nom lisible, playbook).
# Chaque action échouée fait passer à la suivante (escalade).
DECISION_TABLE: dict[str, list[tuple[str, str]]] = {
    "availability_dos": [("ban_attaquant", "ban_ip.yml"), ("restart_payment-api", "restart_service.yml")],
    "service_down": [("restart_service", "restart_service.yml"), ("rollback_image", "rollback_image.yml")],
    "data_incoherent": [("restore_db", "restore_db.yml")],
}


class Remediator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.events: list[dict] = []
        self._lock = asyncio.Lock()  # une remédiation à la fois

    def _emit(self, incident: dict, status: str, action: str | None = None, detail: str = "") -> None:
        self.events.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "type": incident.get("type"),
            "target": incident.get("target"),
            "action": action,
            "status": status,
            "detail": detail,
        })

    async def handle(self, incident: dict) -> None:
        """Traite un incident normalisé {type, target, score?}. Idempotent sous verrou."""
        itype = incident.get("type", "unknown")
        if self._lock.locked():
            log.info("remediation_skipped", reason="déjà en cours", type=itype)
            return
        async with self._lock:
            REMEDIATION_TOTAL.labels(type=itype).inc()
            with REMEDIATION_DURATION.time():
                await self._run(incident, itype)

    async def _run(self, incident: dict, itype: str) -> None:
        t0 = datetime.now(timezone.utc)
        self._emit(incident, "detected", detail=f"score={incident.get('score')}")
        log.warning("remediation_start", type=itype, target=incident.get("target"))
        notify.attack_detected(self.settings, incident)  # mail best-effort : incident détecté

        actions = DECISION_TABLE.get(itype)
        if not actions:
            self._emit(incident, "escalated", detail=f"type inconnu: {itype}")
            return

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                extravars = await self._extravars(client, incident)

            for action_name, playbook in actions:
                self._emit(incident, "running", action=action_name, detail=playbook)
                result = await run_in_threadpool(ansible.run_playbook, self.settings, playbook, extravars)
                if not result["ok"]:
                    self._emit(incident, "running", action=action_name,
                               detail=f"échec playbook (rc={result['rc']}), escalade")
                    continue

                recovery = await verify.verify_recovery(self.settings)
                if recovery["ok"]:
                    REMEDIATION_SUCCESS.labels(type=itype).inc()
                    self._emit(incident, "recovered", action=action_name,
                               detail=f"transaction #{recovery.get('tx_id')} OK après {recovery['attempts']} essai(s)")
                    log.info("remediation_recovered", type=itype, action=action_name)
                    downtime = (datetime.now(timezone.utc) - t0).total_seconds()
                    notify.service_recovered(self.settings, incident, action_name, recovery, downtime)
                    return
        except Exception as exc:  # jamais laisser la tâche de fond crasher sans trace
            self._emit(incident, "escalated", detail=f"erreur interne: {exc}")
            log.exception("remediation_error", type=itype, error=str(exc))
            return

        self._emit(incident, "escalated",
                   detail="reprise non vérifiée après toutes les actions — intervention humaine requise")
        log.error("remediation_escalated", type=itype)

    async def _extravars(self, client: httpx.AsyncClient, incident: dict) -> dict:
        """Prépare les variables des playbooks : ids de conteneurs + signature à bannir."""
        target = incident.get("target", "payment-api")
        target_id = await docker_api.resolve_container_id(client, target)
        waf_id = await docker_api.resolve_container_id(client, "waf")
        sig, sig_source = await signature.top_attacker_signature(client, self.settings)
        log.info("attacker_signature", signature=sig, source=sig_source)
        return {
            "target_service": target,
            "target_container_id": target_id,
            "waf_container_id": waf_id,
            "ban_ua": sig,
            "docker_proxy_url": self.settings.docker_proxy_url,
            "banlist_ua_dir": self.settings.waf_banlist_ua_dir,
            "banlist_ip_dir": self.settings.waf_banlist_ip_dir,
        }
