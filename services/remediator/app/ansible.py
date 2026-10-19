"""Exécution des playbooks Ansible via ansible-runner (hors boucle événementielle)."""
import os

import structlog

from app.config import Settings

log = structlog.get_logger()

# Dossier de travail d'ansible-runner (sur tmpfs, inscriptible même en conteneur read_only)
_PRIVATE_DATA_DIR = "/tmp/ansible"
# Inventaire INI explicite : sans lui, localhost est vu « injoignable » (rc=4)
_INVENTORY = "localhost ansible_connection=local ansible_python_interpreter=/usr/local/bin/python\n"
# Le conteneur est durci (appuser sans home) : forcer les répertoires temporaires dans /tmp
_ENVVARS = {
    "HOME": "/tmp",
    "ANSIBLE_LOCAL_TEMP": f"{_PRIVATE_DATA_DIR}/.tmp",
    "ANSIBLE_REMOTE_TMP": f"{_PRIVATE_DATA_DIR}/.tmp",
}


def _prepare_data_dir() -> None:
    os.makedirs(f"{_PRIVATE_DATA_DIR}/.tmp", exist_ok=True)
    inv_dir = f"{_PRIVATE_DATA_DIR}/inventory"
    os.makedirs(inv_dir, exist_ok=True)
    with open(f"{inv_dir}/hosts", "w", encoding="utf-8") as f:
        f.write(_INVENTORY)


def run_playbook(settings: Settings, playbook: str, extravars: dict) -> dict:
    """Lance un playbook. Renvoie {'ok', 'rc', 'status'}. Appeler dans un threadpool."""
    import ansible_runner  # import paresseux : les tests unitaires n'ont pas besoin d'Ansible

    _prepare_data_dir()
    runner = ansible_runner.run(
        private_data_dir=_PRIVATE_DATA_DIR,
        project_dir=settings.playbooks_dir,        # playbooks montés en lecture seule
        playbook=playbook,
        extravars=extravars,
        envvars=_ENVVARS,
        quiet=True,
    )
    ok = runner.rc == 0 and runner.status == "successful"
    if not ok:
        try:
            tail = "".join(runner.stdout.readlines()[-20:]) if runner.stdout else ""
        except Exception:
            tail = ""
        log.warning("playbook_failed", playbook=playbook, status=runner.status, rc=runner.rc, output=tail)
    else:
        log.info("playbook_run", playbook=playbook, status=runner.status, rc=runner.rc, ok=ok)
    return {"ok": ok, "rc": runner.rc, "status": runner.status}
