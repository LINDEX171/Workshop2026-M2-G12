# remediator

## 1. Rôle
Moteur de remédiation Zero-Touch : reçoit les alertes, **décide** (table type→playbooks),
**agit via Ansible** (bannissement WAF, redémarrage) et **vérifie la reprise** par une vraie transaction.

## 2. Endpoints
| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| POST | `/alert` | non (interne) | Reçoit detector **ou** Alertmanager, lance la remédiation |
| GET | `/events` | non | Journal horodaté (detected→running→recovered/escalated) |
| GET | `/health` | non | 200 |
| GET | `/metrics` | non | Format Prometheus (interne) |

```bash
# Journal (le service n'a aucun port public)
docker compose exec -T remediator python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:8000/events?limit=5').read().decode())"
```

## 3. Variables d'environnement
| Nom | Rôle | Défaut |
|---|---|---|
| `WAF_URL` | Vérification de reprise via le WAF | https://waf:8443 |
| `PAYMENT_URL` | Contrôle `/health` | http://payment-api:8000 |
| `DOCKER_PROXY_URL` | Accès Docker restreint | http://docker-socket-proxy:2375 |
| `LOKI_URL` | Identification de la signature attaquante | http://loki:3100 |
| `PROBE_USER_AGENT` / `SIGNATURE_EXCLUDE_REGEX` / `FALLBACK_ATTACK_SIGNATURE` | Réglages signature | voir .env.example |
| `VERIFY_ATTEMPTS` / `VERIFY_DELAY_SEC` | Essais de la transaction de preuve | 12 / 2 |
| secret `operator_password` | transaction de preuve | — |

## 4. Dépendances
`docker-socket-proxy`, `loki`, `detector` (réseau `ops`) ; `app` pour joindre le WAF et payment-api
lors de la vérification. **Aucun port public.**

## 5. Lancer seul
```bash
docker compose --profile ai up -d docker-socket-proxy remediator
```

## 6. Tester
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/remediator /tmp/s; cd /tmp/s; pip install -q fastapi "uvicorn[standard]" pydantic-settings httpx prometheus-fastapi-instrumentator structlog pytest; python -m pytest -q'
```

## 7. Métriques
`remediation_total{type}`, `remediation_success_total{type}`, `remediation_duration_seconds`.

## 8. Vigilance / limites
- Pas de socket Docker brut (proxy limité à lire + restart/kill), pas d'admin WAF ouverte.
- Bannissement par **signature** (Docker Desktop masque l'IP source). Détails et durcissement :
  [docs/remediation.md](../../docs/remediation.md), runbook [docs/runbooks/remediation-dos.md](../../docs/runbooks/remediation-dos.md).
