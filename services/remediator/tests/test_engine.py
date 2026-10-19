import asyncio

import pytest

from app import ansible, docker_api, engine as engine_module, signature, verify
from app.config import Settings
from app.engine import DECISION_TABLE, Remediator


@pytest.fixture
def patched(monkeypatch):
    """Neutralise les effets de bord (Docker, Loki, Ansible, WAF) ; comportements pilotables."""
    async def fake_resolve(client, service):
        return f"cid-{service}"

    async def fake_signature(client, settings):
        return "ResilienceDoS/1.0", "loki"

    monkeypatch.setattr(docker_api, "resolve_container_id", fake_resolve)
    monkeypatch.setattr(signature, "top_attacker_signature", fake_signature)

    state = {"playbooks": [], "playbook_ok": True, "recovery_ok": True}

    def fake_playbook(settings, playbook, extravars):
        state["playbooks"].append((playbook, extravars))
        if state.get("raise"):
            raise RuntimeError("ansible indisponible")
        return {"ok": state["playbook_ok"], "rc": 0 if state["playbook_ok"] else 2, "status": "successful"}

    async def fake_verify(settings):
        return {"ok": state["recovery_ok"], "tx_id": 99, "attempts": 1, "reason": "ok"}

    monkeypatch.setattr(ansible, "run_playbook", fake_playbook)
    monkeypatch.setattr(verify, "verify_recovery", fake_verify)
    return state


def run(incident, settings=None):
    rem = Remediator(settings or Settings())
    asyncio.run(rem.handle(incident))
    return rem


def test_dos_recovered_after_ban_and_restart(patched):
    rem = run({"type": "availability_dos", "target": "payment-api", "score": 0.9})
    statuses = [e["status"] for e in rem.events]
    assert statuses[0] == "detected"
    assert "running" in statuses
    assert statuses[-1] == "recovered"
    # La première action (ban) a suffi à rétablir : un seul playbook joué
    assert patched["playbooks"][0][0] == "ban_ip.yml"
    # La signature identifiée est transmise au playbook
    assert patched["playbooks"][0][1]["ban_ua"] == "ResilienceDoS/1.0"


def test_escalation_when_recovery_never_verified(patched):
    patched["recovery_ok"] = False
    rem = run({"type": "availability_dos", "target": "payment-api", "score": 0.9})
    assert rem.events[-1]["status"] == "escalated"
    # Les deux actions de la table ont été tentées avant d'escalader
    assert [p[0] for p in patched["playbooks"]] == ["ban_ip.yml", "restart_service.yml"]


def test_unknown_type_escalates(patched):
    rem = run({"type": "meteorite", "target": "payment-api"})
    assert rem.events[-1]["status"] == "escalated"
    assert patched["playbooks"] == []


def test_failed_playbook_moves_to_next_action(patched):
    patched["playbook_ok"] = False
    patched["recovery_ok"] = False
    rem = run({"type": "service_down", "target": "payment-api"})
    # Les deux playbooks de service_down sont tentés malgré les échecs
    assert [p[0] for p in patched["playbooks"]] == ["restart_service.yml", "rollback_image.yml"]
    assert rem.events[-1]["status"] == "escalated"


def test_internal_error_escalates_without_crashing(patched):
    patched["raise"] = True  # simule un plantage d'ansible-runner
    rem = run({"type": "availability_dos", "target": "payment-api", "score": 0.9})
    assert rem.events[-1]["status"] == "escalated"
    assert "erreur interne" in rem.events[-1]["detail"]


def test_decision_table_matches_build_plan():
    assert DECISION_TABLE["availability_dos"][0][1] == "ban_ip.yml"
    assert DECISION_TABLE["availability_dos"][1][1] == "restart_service.yml"
    assert DECISION_TABLE["service_down"][1][1] == "rollback_image.yml"
    assert DECISION_TABLE["data_incoherent"][0][1] == "restore_db.yml"
