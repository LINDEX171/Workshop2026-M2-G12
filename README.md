<p align="center">
  <img src="frontend/src/components/resilience-alpha-logo.svg" alt="Resilience Alpha" width="360">
</p>

# RESILIENCE-ALPHA — Groupe 12

Plateforme de paiement fictive conteneurisée qui **subit une attaque**, la **détecte par
Machine Learning**, se **répare toute seule** (Zero-Touch Recovery) et **prouve la reprise**
en rejouant une transaction qui réussit.

> Projet workshop M2 — domaines : Développement, Infrastructure, IA/Data, Cybersécurité,
> Gouvernance. Toutes les attaques visent **uniquement** ce SI fictif.

---

## 1. Architecture

```
                         Internet / LAN RESILIENCE-G12
                                   │  443 (HTTPS)
                        ┌──────────▼──────────┐
                        │   WAF (ModSecurity  │  ← seul point d'entrée exposé
                        │     + OWASP CRS)    │
                        └──────────┬──────────┘
                   /    /api/auth  │  /api/pay   /api/status  /api/assistant
            ┌──────────┐   ┌───────▼──┐   ┌──────────┐   ┌──────────┐
            │ frontend │   │   auth   │   │payment-api│  │ detector │
            └──────────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
                                │ auth-data     │ data         │ ops
                           ┌────▼───┐      ┌────▼───┐    ┌─────▼─────┐
                           │auth-db │      │   db   │    │remediator │──Ansible──▶ docker-socket-proxy
                           └────────┘      └────────┘    └─────┬─────┘
                                                               │ détecte via Prometheus, agit, vérifie
   Observabilité : Prometheus · Loki/Promtail · Grafana · cAdvisor · postgres-exporter · Alertmanager
   IA : Ollama (+ assistant RAG)
```

### Réseaux (cloisonnement = argument cyber)
| Réseau | Qui y est | Rôle |
|---|---|---|
| `public` | waf, frontend, load-generator | Seule zone exposée |
| `app` | waf, frontend, auth, payment-api, detector, assistant, remediator, prometheus | Trafic applicatif |
| `data` | payment-api, db, adminer, postgres-exporter | Données paiements (**auth n'y est pas**) |
| `auth-data` | auth, auth-db | Base des utilisateurs (interne, isolée) |
| `ops` | detector, remediator, docker-socket-proxy, observabilité, ollama, assistant | Supervision + remédiation |

### Flux incident → reprise
```
PC Attaquant → waf → payment-api            (DoS : latence + CPU montent)
detector lit Prometheus → score ML > seuil → POST /alert au remediator
(2e voie) Alertmanager → webhook remediator
remediator → Ansible : bannit la signature de l'attaquant au WAF + restart payment-api
remediator vérifie : transaction de test via le WAF → 200 OK  → "recovered"
dashboard repasse au vert, nouvelle transaction réussit → PREUVE
```

---

## 2. Prérequis
- Docker Desktop (WSL2) ou Docker Engine + Compose v2, ~8 Go RAM.
- Git Bash (Windows) pour les scripts `.sh`.
- `age` + `sops` (secrets) ; Ollama tire ses modèles au 1er lancement.
- Node 22 et Python ne sont **pas** requis sur l'hôte (tout est conteneurisé).

## 3. Installation (5 commandes)
```bash
git clone <repo> && cd Workshop2026-M2-G12
./scripts/init_age_key.sh          # clé age (ou copier la clé d'équipe dans ~/.config/sops/age/keys.txt)
./scripts/decrypt_secrets.sh       # secrets.enc.env -> secrets/*.txt  (ou ./scripts/init_dev_secrets.sh en dev)
./scripts/gen_cert.sh && cp -n .env.example .env
docker compose --profile full build && docker compose --profile full up -d
```
Puis, une fois pour l'IA : `./scripts/pull_models.sh` (modèles Ollama + indexation de l'assistant).

## 4. Lancer la démo
```bash
./scripts/reset_demo.sh      # retour à l'état AVANT (<60s)
./scripts/demo.sh            # attaque -> détection -> remédiation -> preuve, RTO mesuré
./scripts/demo_replay.sh 10  # rejoue 10 fois, journalise le RTO (objectif 10/10)
```
RTO mesuré : **~13–20 s** par reprise autonome.

## 5. Travailler sur un seul service
Branche dédiée (`feat/<service>`) + profil Compose :
```bash
docker compose --profile core up -d        # db, auth, payment-api, waf, frontend
docker compose --profile obs up -d         # prometheus, grafana, loki, promtail, exporters
docker compose --profile ai up -d          # detector, remediator, assistant, ollama
docker compose --profile attack up -d      # load-generator
docker compose --profile full up -d        # TOUT
```
Tests d'un service (sans l'hôte) :
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/<svc> /tmp/s; cd /tmp/s; pip install -q -r requirements-dev.txt; python -m pytest -q'
```

## 6. Services, ports et profils
| Service | Rôle | Port interne | Publié | Profils |
|---|---|---|---|---|
| frontend | UI paiement + supervision + assistant | 8080 | via WAF | core, security, full |
| auth | Login, JWT, rôles | 8000 | non | core, full |
| payment-api | Comptes, transactions | 8000 | non | core, full |
| detector | Score d'anomalie ML, /status | 8000 | non | ai, full |
| remediator | Remédiation Zero-Touch | 8000 | non | ai, full |
| assistant | RAG sur la doc | 8000 | non | ai, full |
| db / auth-db | PostgreSQL 16 | 5432 | **aucun** | core/obs/ai, full |
| waf | Reverse proxy + pare-feu | 8443/8080 | `443`, `80` | core, security, full |
| grafana | Dashboards + SOC | 3000 | `127.0.0.1:3000` | obs, full |
| adminer | Interface Postgres | 8080 | `127.0.0.1:8081` | core, full |
| prometheus / loki / … | Observabilité | — | non | obs, full |
| ollama | LLM local | 11434 | non | ai, full |

## 7. Accès
- **Application** : https://localhost (via le WAF ; certificat auto-signé → avertissement, ou `mkcert` pour l'éviter).
- **Grafana** : http://localhost:3000 — `admin` / `cat secrets/grafana_admin_password.txt`.
- **Adminer** : http://localhost:8081 — Système PostgreSQL, Serveur `db`, Utilisateur `payadmin`,
  Base `payments`, mot de passe `cat secrets/pg_password.txt`. **Jamais exposé sur le réseau.**

## 8. Structure du dépôt
```
services/        # microservices FastAPI (auth, payment-api, detector, remediator, assistant) + load-generator
frontend/        # React + Vite + Tailwind, servi par Nginx
infra/           # waf, prometheus, alertmanager, grafana, loki, promtail, postgres (SQL), banlists
ansible/         # deploy.yml, reset.yml, playbooks via le remediator
attack/          # dos_attack.py, sqli_probe.py, bruteforce_auth.py (PC attaquant)
scripts/         # démo, reset, secrets, modèles, santé, attaques
docs/            # architecture, détection ML, remédiation, secrets, gouvernance (ebios, pca-pra, nis2-dora), runbooks
secrets/         # secrets.enc.env (chiffré SOPS) ; *.txt déchiffrés (gitignorés)
docker-compose.yml  .sops.yaml  .env.example  Makefile
```

## 9. Sécurité (synthèse)
- **Cloisonnement réseau** : auth ne peut pas joindre la base des paiements ; bases sans port publié.
- **Moindre privilège** : rôles SQL applicatifs limités ; journal de transactions en ajout seul.
- **WAF** ModSecurity + OWASP CRS en blocage (SQLi/XSS 403), anti brute force, bannissement.
- **Remédiation** sans socket Docker brut (proxy restreint), sans port public, sans admin ouverte.
- **Secrets** chiffrés SOPS + age, jamais en clair dans le dépôt.
- **Assistant** en lecture seule, aucun privilège (distinct du remediator).
Détails : [docs/architecture.md](docs/architecture.md), [docs/secrets.md](docs/secrets.md).

## 10. Dépannage
Voir la section 13 ci-dessous.

## 11. Gouvernance
[docs/ebios/](docs/ebios/) · [docs/pca-pra.md](docs/pca-pra.md) · [docs/nis2-dora.md](docs/nis2-dora.md) · [docs/runbooks/](docs/runbooks/).

## 12. Contributions
_(à compléter par l'équipe : qui a fait quoi par domaine/service)._

---

## 13. Dépannage
- **Conteneur `unhealthy`** : `docker compose logs <svc>` ; vérifier `/health` et les dépendances.
- **payment-api ne joint pas db** : même réseau `data` ? secret `payuser_password` déchiffré ?
- **auth joint db (anormal)** : auth ne doit PAS être sur `data`.
- **Prometheus cible DOWN** : chemin `/metrics` et port 8000.
- **WAF 404 après modif de routage** : `docker compose up -d --force-recreate waf` (régénération au démarrage).
- **WAF `map_hash` emerg** : `map_hash_bucket_size` déjà relevé à 256 ; vérifier les fichiers de banlist.
- **Assistant lent / RAM saturée** : passer `OLLAMA_MODEL=qwen2.5:1.5b` puis `./scripts/pull_models.sh`.
- **Démo intermittente** : augmenter `VERIFY_ATTEMPTS` du remediator ; `./scripts/reset_demo.sh` entre deux runs.

## 14. Checklist de rendu
Voir [docs/checklist-rendu.md](docs/checklist-rendu.md).
