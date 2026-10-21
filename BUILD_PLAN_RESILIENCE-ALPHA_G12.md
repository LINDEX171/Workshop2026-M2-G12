# BUILD PLAN — PROJECT RESILIENCE-ALPHA

> **À destination de Claude Code.** Ce fichier est le cahier des charges d'exécution du projet. Il est organisé en **phases** et en **étapes numérotées**. Chaque étape finit par un bloc **✅ Validation** (ce qu'il faut vérifier) et, aux jalons, par un marqueur **→ COMMIT**. **Ne rédige PAS les messages de commit** : laisse l'équipe les écrire. Arrête-toi à la fin de chaque phase pour permettre à l'équipe de reprendre la main.
>
> **Priorité absolue : le socle Docker (Phases 0 et 1).** Une fois ce socle posé et conventionné, chaque membre doit pouvoir développer son microservice **isolément** sans casser celui des autres. Respecte les conventions de la section 3 à la lettre : c'est ce qui garantit une intégration sans douleur le mercredi.

---

## 0. Brief projet (contexte pour Claude Code)

On construit une **plateforme de paiement fictive conteneurisée** qui doit :
1. traiter des transactions fictives (métier réel, pas une maquette) ;
2. subir une **attaque lancée depuis un PC distinct** ;
3. **détecter** l'anomalie via un modèle de Machine Learning (pas des seuils en dur) ;
4. **se réparer toute seule** (Zero-Touch Recovery) via un moteur de remédiation ;
5. **prouver la reprise** en rejouant une transaction qui réussit, avec données cohérentes.

Cinq domaines obligatoires : Développement, Infrastructure, IA/Data, Cybersécurité, Gouvernance.

**Contraintes dures :**
- Backend en **Python 3.12 / FastAPI**. Frontend en **React + Vite + Tailwind**.
- Orchestration **Docker Compose** + automatisation **Ansible**.
- Observabilité **Prometheus + Grafana + Loki** (interdit : Elastic, trop lourd).
- IA : détection **scikit-learn (Isolation Forest)** + assistant **RAG Ollama + LangChain + Chroma**, modèle **≤ 8 Md de paramètres**.
- Sécurité : **WAF ModSecurity**, fonction **SOC dans Grafana**, secrets **SOPS + age**.
- Secrets **jamais en clair** dans le dépôt. Base de données **jamais exposée** sur le réseau.
- Réseau : point d'accès Windows `RESILIENCE-G12`, PC Hôte en `192.168.137.1`.

**Livrables finaux (noms stricts, dans un dossier `Workshop2026-M2-G12`) :**
- `Workshop2026-M2-G12-Dossier.pdf` (8–12 p.)
- `Workshop2026-M2-G12-Pres.pptx`
- `Workshop2026-M2-G12-VidChrono.mp4` (60 s max)
- `Workshop2026-M2-G12-Code.zip` (le dépôt Git, aucun secret en clair)

---

## 1. Architecture cible

### 1.1 Services

| Service | Rôle | Techno | Image/Build | Codé par nous ? |
|---|---|---|---|---|
| `frontend` | Interface paiement + dashboard supervision | React+Vite+Tailwind | build | ✅ |
| `auth` | Login, JWT, rôles | FastAPI | build | ✅ |
| `payment-api` | Comptes, transactions (cœur métier) | FastAPI | build | ✅ |
| `detector` | Score d'anomalie ML, alerte le remediator | FastAPI + scikit-learn | build | ✅ |
| `remediator` | Décide et exécute la remédiation | FastAPI + ansible-runner | build | ✅ |
| `assistant` | RAG sur la doc interne | FastAPI + LangChain + Chroma | build | ✅ |
| `db` | PostgreSQL 16 | PostgreSQL | image | ⚙️ config |
| `adminer` | Interface web Postgres (local only) | Adminer | image | ⚙️ config |
| `waf` | Reverse proxy + pare-feu applicatif | Nginx + ModSecurity + CRS | image | ⚙️ config |
| `prometheus` | Métriques | Prometheus | image | ⚙️ config |
| `alertmanager` | Alertes → webhook remediator | Alertmanager | image | ⚙️ config |
| `grafana` | Dashboards + vue SOC | Grafana | image | ⚙️ config |
| `loki` | Stockage logs | Loki | image | ⚙️ config |
| `promtail` | Collecte logs conteneurs | Promtail | image | ⚙️ config |
| `cadvisor` | Métriques CPU/RAM par conteneur | cAdvisor | image | ⚙️ config |
| `postgres-exporter` | Métriques Postgres | postgres-exporter | image | ⚙️ config |
| `docker-socket-proxy` | Accès Docker restreint pour le remediator | Tecnativa | image | ⚙️ config |
| `ollama` | LLM local (sur PC délestage IA de préférence) | Ollama | image | ⚙️ config |
| `load-generator` | Trafic normal (entraînement ML + preuve de vie) | Locust | build léger | ✅ |

### 1.2 Réseaux Docker (cloisonnement = argument cyber)

| Réseau | Qui y est | Rôle |
|---|---|---|
| `public` | `waf`, `frontend` | Seule zone exposée sur `192.168.137.1` |
| `app` | `waf`, `frontend`, `auth`, `payment-api`, `assistant`, `prometheus` | Trafic applicatif |
| `data` | `payment-api`, `db`, `adminer`, `postgres-exporter` | Données. **`auth` n'y est pas → ne peut pas joindre la BDD** |
| `ops` | `detector`, `remediator`, `docker-socket-proxy`, `prometheus`, `alertmanager`, `grafana`, `loki`, `promtail`, `cadvisor`, `assistant` | Supervision + remédiation |

**Règle d'or :** seul le `waf` publie des ports vers l'extérieur (`443`). `adminer` et `grafana` sont publiés **uniquement sur `127.0.0.1`** du PC Hôte. **`db` ne publie AUCUN port.**

### 1.3 Flux nominal et flux d'incident

```
NOMINAL :
  navigateur → waf:443 → frontend (dashboard + paiement)
  frontend → waf → payment-api → auth (verify token)
                              → db (écrit la transaction)
  tous les services → Prometheus (/metrics) et Loki (logs)

INCIDENT (attaque → reprise) :
  PC Attaquant → waf → payment-api        (DoS applicatif : latence + 5xx montent)
  Prometheus scrape les métriques dégradées
  detector lit Prometheus → score d'anomalie > seuil → POST /alert au remediator
  (en parallèle) Alertmanager → webhook remediator   (double voie, fiabilité)
  remediator choisit le playbook → Ansible :
        1) ban de l'IP attaquante au WAF
        2) restart de payment-api via docker-socket-proxy
  remediator vérifie la reprise : POST /transactions de test → 200 OK
  dashboard repasse au vert, nouvelle transaction réussit → PREUVE
```

---

## 2. Arborescence cible du dépôt

Crée exactement cette structure (fichiers détaillés dans les phases) :

```
resilience-alpha/
├── README.md                      # README racine (Phase 12)
├── Makefile
├── docker-compose.yml             # stack complète, profils
├── .gitignore
├── .sops.yaml                     # règles de chiffrement
├── .env.example                   # variables non secrètes, documentées
├── secrets/
│   └── secrets.enc.env            # secrets chiffrés SOPS (jamais en clair)
├── services/
│   ├── auth/
│   │   ├── app/main.py
│   │   ├── app/… 
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   ├── payment-api/   (même structure)
│   ├── detector/      (même structure + model/)
│   ├── remediator/    (même structure + playbooks/)
│   ├── assistant/     (même structure + knowledge/)
│   └── load-generator/
├── frontend/
│   ├── src/…
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── README.md
├── infra/
│   ├── waf/
│   │   ├── modsecurity/
│   │   └── conf.d/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── rules/alerts.yml
│   ├── alertmanager/alertmanager.yml
│   ├── grafana/
│   │   ├── provisioning/datasources/
│   │   ├── provisioning/dashboards/
│   │   └── dashboards/*.json
│   ├── loki/loki-config.yml
│   ├── promtail/promtail-config.yml
│   └── postgres/initdb/*.sql
├── ansible/
│   ├── ansible.cfg
│   ├── inventory.ini
│   ├── deploy.yml
│   ├── reset.yml
│   └── playbooks/
│       ├── ban_ip.yml
│       ├── restart_service.yml
│       ├── rollback_image.yml
│       └── restore_db.yml
├── attack/
│   ├── README.md
│   ├── dos_attack.py              # ou locustfile
│   ├── sqli_probe.py
│   └── bruteforce_auth.py
├── docs/
│   ├── architecture.md
│   ├── runbooks/
│   ├── ebios/
│   └── pca-pra.md
└── scripts/
    ├── demo.sh
    ├── healthcheck_all.sh
    └── train_model.sh
```

---

## 3. Conventions partagées — NON NÉGOCIABLES

> Ces règles permettent à 5 personnes de bosser en parallèle. Claude Code doit les imposer dans chaque service généré.

### 3.1 Services FastAPI
- Écoutent **tous** sur le port interne **8000** (`uvicorn app.main:app --host 0.0.0.0 --port 8000`).
- Exposent **obligatoirement** :
  - `GET /health` → `200` avec corps JSON :
    ```json
    { "status": "ok", "service": "payment-api", "deps": { "db": "ok", "auth": "ok" } }
    ```
    Retourne `503` si une dépendance critique est KO (le health check doit être honnête, c'est ce que teste le remediator).
  - `GET /metrics` → format Prometheus, via `prometheus-fastapi-instrumentator`.
- Variables d'environnement lues via **Pydantic Settings** (`app/config.py`). Jamais de valeur en dur.
- Appels inter-services via `httpx.AsyncClient(timeout=2.0)`. **Toujours un timeout.**
- Logs en **JSON sur stdout** (lib `structlog` ou formatter JSON), pour que Promtail/Loki les parsent.

### 3.2 Nommage
- Nom de service = nom de dossier = hostname Docker (ex. `payment-api`).
- URL interne d'un service : `http://<service>:8000`.
- Pas de `localhost` entre conteneurs, jamais.

### 3.3 Docker
- Chaque service a son `Dockerfile` **multi-stage si besoin**, tourne en **non-root** (`USER appuser`).
- `read_only: true` + `tmpfs` pour l'éphémère quand c'est possible, `cap_drop: ALL`.
- Health check Docker aligné sur `/health`.
- Aucun service autre que `waf` ne définit de `ports:` exposés vers `0.0.0.0`. `adminer`/`grafana` → `127.0.0.1:...`.

### 3.4 Variables d'environnement
- `.env.example` à la racine et dans chaque service : **toutes** les variables, valeurs factices, commentées.
- Les vraies valeurs non secrètes → `.env` (gitignored).
- Les **secrets** (mots de passe DB, clé JWT) → `secrets/secrets.enc.env` chiffré SOPS.

### 3.5 Git (workflow équipe, mais messages écrits par l'humain)
- Branche par service : `feat/auth`, `feat/payment-api`, etc. `main` protégée.
- Claude Code **ne commit pas lui-même** sauf demande explicite ; il **prépare** les changements et signale **→ COMMIT** aux jalons. L'équipe rédige le message et commit.
- `.gitignore` couvre : `.env`, `*.key`, `secrets/*.dec*`, `__pycache__/`, `node_modules/`, `frontend/dist/`, `services/detector/model/*.pkl` (le modèle se régénère via `scripts/train_model.sh`), volumes locaux.

### 3.6 Profils Compose (travail isolé)
Chaque membre lance **seulement** ce dont il a besoin :
```bash
docker compose --profile core up -d        # db, auth, payment-api, waf, frontend
docker compose --profile obs up -d         # prometheus, grafana, loki, promtail, cadvisor, exporters
docker compose --profile security up -d     # waf (+ dépendances)
docker compose --profile ai up -d           # detector, assistant, ollama
docker compose --profile attack up -d       # load-generator
docker compose --profile full up -d         # TOUT
```
Un service peut porter plusieurs profils. `db` doit être dans `core`, `obs` (exporter) et `ai`.

---

## PHASE 0 — Bootstrap du dépôt

**Objectif :** squelette du dépôt, Makefile, gitignore, compose vide mais valide. Rien ne tourne encore, mais `docker compose config` doit passer.

1. Crée l'arborescence de la section 2 (dossiers + fichiers vides `.gitkeep` là où c'est nécessaire).
2. Crée `.gitignore` selon 3.5.
3. Crée `.env.example` racine avec au minimum :
   ```
   # --- Global ---
   COMPOSE_PROJECT_NAME=resilience-g12
   TZ=Europe/Paris
   # --- Postgres (le mot de passe réel vient de SOPS) ---
   POSTGRES_USER=payadmin
   POSTGRES_DB=payments
   # --- JWT (clé réelle via SOPS) ---
   JWT_ALG=HS256
   JWT_EXPIRE_MIN=30
   # --- Services (URLs internes) ---
   AUTH_URL=http://auth:8000
   PAYMENT_URL=http://payment-api:8000
   PROMETHEUS_URL=http://prometheus:9090
   # --- Détection ---
   DETECTOR_INTERVAL_SEC=10
   DETECTOR_THRESHOLD=0.65
   # --- Remédiation ---
   REMEDIATOR_URL=http://remediator:8000
   # --- Assistant ---
   OLLAMA_URL=http://ollama:11434
   OLLAMA_MODEL=qwen2.5:3b
   ```
4. Crée le `Makefile` :
   ```makefile
   .PHONY: up down reset logs ps health build
   up:      ; docker compose --profile full up -d
   down:    ; docker compose --profile full down
   reset:   ; docker compose --profile full down -v --remove-orphans && docker compose --profile full up -d
   build:   ; docker compose --profile full build
   ps:      ; docker compose ps
   logs:    ; docker compose logs -f $(svc)
   health:  ; ./scripts/healthcheck_all.sh
   ```
5. Crée `docker-compose.yml` avec la déclaration des 4 réseaux (section 1.2) et un en-tête, sans services pour l'instant.

**✅ Validation :** `docker compose config` ne renvoie aucune erreur ; l'arborescence correspond à la section 2.
**→ COMMIT** (bootstrap).

---

## PHASE 1 — Socle Docker : tous les services en squelette (LA phase clé)

**Objectif :** tous les conteneurs montent ensemble, chacun répond `/health`, les réseaux cloisonnent correctement. Après cette phase, **chaque membre peut développer son service sans attendre les autres.**

### 1.A Template de microservice FastAPI
Crée un squelette **identique** pour `auth`, `payment-api`, `detector`, `remediator`, `assistant` :

- `requirements.txt` :
  ```
  fastapi==0.115.*
  uvicorn[standard]==0.32.*
  pydantic-settings==2.*
  httpx==0.27.*
  prometheus-fastapi-instrumentator==7.*
  structlog==24.*
  ```
- `app/config.py` : `Settings(BaseSettings)` lisant l'env.
- `app/main.py` (squelette) :
  ```python
  from fastapi import FastAPI
  from prometheus_fastapi_instrumentator import Instrumentator
  import structlog, os

  log = structlog.get_logger()
  SERVICE = os.getenv("SERVICE_NAME", "unknown")
  app = FastAPI(title=SERVICE)
  Instrumentator().instrument(app).expose(app)

  @app.get("/health")
  async def health():
      return {"status": "ok", "service": SERVICE, "deps": {}}
  ```
- `Dockerfile` (voir 3.3) : base `python:3.12-slim`, non-root, `CMD uvicorn`.
- `.env.example` propre au service.
- `tests/test_health.py` minimal (TestClient sur `/health`).

### 1.B Services sur image
- `db` (postgres:16) : volume `pgdata`, pas de `ports:`, `data` net, `initdb` monté (vide pour l'instant), mot de passe via secret.
- `adminer` : `127.0.0.1:8081:8080`, net `data`.
- `prometheus`, `grafana`, `loki`, `promtail`, `cadvisor`, `postgres-exporter`, `alertmanager` : déclarés avec configs vides/minimales (remplies en Phase 4).
- `waf`, `ollama`, `docker-socket-proxy` : déclarés, configs minimales (remplies plus tard).

### 1.C Compose complet (profils + health + réseaux)
Assemble tout dans `docker-compose.yml`. Exemple pour deux services (applique le même patron partout) :
```yaml
services:
  payment-api:
    build: ./services/payment-api
    environment:
      SERVICE_NAME: payment-api
    env_file: [.env]
    networks: [app, data]
    profiles: [core, full]
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"]
      interval: 10s
      timeout: 3s
      retries: 5
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    depends_on:
      db: { condition: service_healthy }
      auth: { condition: service_started }

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/initdb:/docker-entrypoint-initdb.d:ro
    networks: [data]
    profiles: [core, obs, ai, full]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
networks:
  public: {}
  app: {}
  data: {}
  ops: {}
```
> Note : en Phase 1 le mot de passe peut venir d'un `.env` temporaire ; on bascule sur SOPS/secrets en Phase 10. Déclare déjà le mécanisme pour ne pas le refaire.

### 1.D Script de contrôle santé
`scripts/healthcheck_all.sh` : boucle sur chaque service codé, `curl -fsS http://<host>:8000/health` (depuis un conteneur du bon réseau ou via `docker exec`), affiche ✅/❌ par service.

**✅ Validation :**
- `make build && docker compose --profile full up -d` : tous les conteneurs `healthy`.
- `make health` : tous ✅.
- Test de cloisonnement : `docker compose exec auth python -c "import socket; socket.create_connection(('db',5432),2)"` doit **échouer** (auth n'a pas accès à `data`). `payment-api` vers `db` doit **réussir**.
- `db` n'a aucun port visible via `docker compose ps`.
**→ COMMIT** (socle Docker complet). **Point de reprise : chaque membre part sur sa branche de service.**

---

## PHASE 2 — Métier : db + payment-api + auth

**Objectif :** une transaction fictive peut être créée et lue, protégée par un token.

1. **Schéma SQL** (`infra/postgres/initdb/`) :
   - `01_schema_auth.sql` : rôle `authuser`, schéma `auth`, table `users(id, username, password_hash, role)`, un utilisateur `operator` seedé.
   - `02_schema_payments.sql` : rôle `payuser`, schéma `payments`, tables `accounts(id, owner, balance)` et `transactions(id, src, dst, amount, status, created_at)`. Seed 3 comptes.
   - Chaque rôle n'a de droits que sur SON schéma (argument moindre privilège).
2. **`auth`** : `POST /login` (vérifie hash, renvoie JWT), `GET /verify` (valide le token), `GET /me`. Hash via `passlib[bcrypt]`. `/health` vérifie sa base.
3. **`payment-api`** : 
   - `POST /transactions` (exige header Authorization → appelle `auth:/verify` avec timeout, insère en base, renvoie l'id et le statut).
   - `GET /transactions`, `GET /accounts`, `GET /transactions/{id}`.
   - `/health` vérifie `db` **et** `auth`.
   - Instrumente des métriques métier custom : `tx_total`, `tx_failed_total`, `tx_latency_seconds` (histogramme).
4. Ajoute `psycopg[binary]` et `sqlalchemy` aux requirements concernés.
5. Tests : création d'un token, transaction acceptée avec token, refusée sans token (401).

**✅ Validation :**
```bash
TOKEN=$(curl -s waf/.../login ... | jq -r .token)   # ou via adminer + curl direct
curl -s -H "Authorization: Bearer $TOKEN" -X POST payment-api/transactions -d '{"dst":2,"amount":10}'   # 200
curl -s -X POST payment-api/transactions -d '{"dst":2,"amount":10}'                                      # 401
```
Vérifie dans **Adminer** (`http://127.0.0.1:8081`) que la transaction est en base.
**→ COMMIT** (métier fonctionnel).

---

## PHASE 3 — Frontend React + Tailwind (paiement + dashboard)

**Objectif :** interface de paiement **et** dashboard de supervision, servie par Nginx, derrière le WAF.

1. `npm create vite@latest` (React + TS), Tailwind configuré.
2. Pages :
   - **Paiement** : formulaire login → token stocké en mémoire → formulaire transaction → liste des transactions (rafraîchie).
   - **Supervision / État du service** : bandeau **AVANT / PENDANT / APRÈS** avec, pour chaque service, un pastille verte/rouge (lue via `/health` ou via un endpoint d'agrégation du `payment-api`/`detector`), le **score d'anomalie courant** (depuis `detector:/score`), et le **journal des remédiations** (depuis `remediator:/events`).
   - Un lien vers Grafana pour l'approfondissement.
3. `Dockerfile` multi-stage (build Vite → Nginx), `nginx.conf` qui sert `dist/` et proxyfie `/api/*` vers les services (en dev) — en prod c'est le WAF qui route.
4. Tout appel API passe par le WAF en démo.

**✅ Validation :** depuis le PC Hôte, le parcours complet marche dans le navigateur ; le dashboard montre 4+ services au vert.
**→ COMMIT** (frontend + dashboard).

---

## PHASE 4 — Observabilité : Prometheus, Loki, Promtail, Grafana, cAdvisor, Alertmanager

**Objectif :** la chaîne de métriques et de logs alimente **réellement** l'analyse de l'incident, tout provisionné par fichiers (aucun clic manuel).

1. **Prometheus** (`infra/prometheus/prometheus.yml`) : scrape `auth`, `payment-api`, `detector`, `remediator`, `assistant` (`/metrics`), `cadvisor`, `postgres-exporter`, lui-même. Intervalle 5–10 s.
2. **Règles d'alerte** (`infra/prometheus/rules/alerts.yml`) : ex. `HighErrorRate` (ratio 5xx), `HighLatencyP95`, `PaymentApiDown`. Ces alertes partent vers Alertmanager.
3. **Alertmanager** (`infra/alertmanager/alertmanager.yml`) : un receiver `webhook` → `http://remediator:8000/alert`. Group/throttle courts pour la démo.
4. **Loki** + **Promtail** : Promtail lit les logs de **tous** les conteneurs Docker (`/var/lib/docker/containers`), parse le JSON, étiquette par `service`.
5. **Grafana** provisionné :
   - datasources Prometheus + Loki (fichiers).
   - **Dashboard technique** : req/s, taux 5xx, latence p95, CPU/RAM par conteneur, transactions/s, score d'anomalie.
   - **Dashboard "SOC"** : logs WAF (requêtes bloquées), tentatives d'auth échouées, actions de remédiation, timeline de l'incident. Alerting LogQL sur pics d'erreurs auth.
   - Publié sur `127.0.0.1:3000`.
6. Les dashboards Grafana sont des **fichiers JSON versionnés** dans `infra/grafana/dashboards/`.

**✅ Validation :** Prometheus voit toutes les cibles `UP` ; Loki affiche les logs filtrés par service ; les deux dashboards Grafana se chargent automatiquement au démarrage (rien à importer à la main).
**→ COMMIT** (observabilité).

---

## PHASE 5 — WAF (ModSecurity + OWASP CRS)

**Objectif :** point d'entrée unique durci, journaux exploitables pour l'investigation et pour la remédiation.

1. Service `waf` basé sur `owasp/modsecurity-crs:nginx`.
2. Config reverse proxy : route `/` → `frontend`, `/api/auth/*` → `auth`, `/api/pay/*` → `payment-api`. Seul le WAF publie `443` sur `192.168.137.1` (TLS auto-signé pour la démo).
3. ModSecurity en mode **blocage** (pas juste détection) pour SQLi/XSS, journaux d'audit en **JSON** envoyés vers Loki (via Promtail).
4. Expose une **surface d'administration minimale** côté remédiation pour **bannir une IP** (ex. une liste `deny` rechargeable, ou endpoint interne protégé, joignable seulement depuis le réseau `ops` par le remediator). **Pas d'admin ouverte à tous** (piège du sujet).

**✅ Validation :** une requête SQLi évidente vers `/api/pay/...` est **bloquée (403)** et apparaît dans le dashboard SOC ; le trafic légitime passe normalement.
**→ COMMIT** (WAF + routage).

---

## PHASE 6 — Détection ML (Isolation Forest)

**Objectif :** détection d'anomalie apprise, explicable, branchée sur Prometheus. Pas de seuils en dur.

1. **Features** (fenêtre glissante lue depuis Prometheus via son API HTTP) : req/s, ratio 5xx, latence p95, CPU `payment-api`, RAM `payment-api`, connexions DB, taux d'échec transactions.
2. **Entraînement** (`scripts/train_model.sh` + `services/detector/train.py`) : génère 20–30 min de trafic **normal** avec `load-generator`, collecte les features, entraîne `IsolationForest`, sérialise `model/model.pkl` + le `scaler`. Documente le jeu de données.
3. **Service `detector`** : toutes les `DETECTOR_INTERVAL_SEC`, calcule le score, l'expose sur `GET /score`, et si score > `DETECTOR_THRESHOLD` fait `POST remediator:/alert` avec un payload typé :
   ```json
   { "type": "availability_dos", "target": "payment-api", "score": 0.82, "evidence": {"p95": 4.1, "err_rate": 0.37} }
   ```
4. Expose des métriques : `anomaly_score`, `anomaly_detected_total`.
5. **Dossier technique** (`docs/` ) : données, préparation, modèle, résultats, **limites** (sujet exige les limites).

**✅ Validation :** en trafic normal, score bas et stable ; sous charge anormale (lancer `attack/`), le score franchit le seuil et un `/alert` part vers le remediator (visible dans les logs).
**→ COMMIT** (détection ML).

---

## PHASE 7 — Remédiation (remediator + Ansible + docker-socket-proxy)

**Objectif :** le cœur Zero-Touch. Décide, agit via Ansible, **vérifie** la reprise. C'est l'axe noté 5/5 (ou 0/5).

1. **`docker-socket-proxy`** (Tecnativa) : n'autorise au remediator que `CONTAINERS=1`, `POST=1` restreint à restart, `INFO=1`. Pas d'accès brut au socket Docker. Réseau `ops` seulement.
2. **Service `remediator`** :
   - `POST /alert` : reçoit du detector **ou** d'Alertmanager. Normalise les deux formats.
   - **Table de décision** `type → playbook` :
     | type | action |
     |---|---|
     | `availability_dos` | `ban_ip.yml` + `restart_service.yml` |
     | `service_down` | `restart_service.yml` (puis `rollback_image.yml` si échec) |
     | `data_incoherent` | `restore_db.yml` |
   - Exécute le playbook via **`ansible-runner`**.
   - **Vérification de reprise** : POST `/transactions` de test authentifié ; relit le résultat ; ne déclare `recovered` que si la transaction réussit ET `/health` repasse `ok`. Sinon escalade (action suivante) puis alerte "intervention humaine requise".
   - `GET /events` : journal horodaté des remédiations (pour le dashboard et le dossier).
   - Métriques : `remediation_total`, `remediation_success_total`, `remediation_duration_seconds`.
3. **Playbooks Ansible** (`ansible/playbooks/`) :
   - `ban_ip.yml` : ajoute l'IP à la deny-list WAF et recharge.
   - `restart_service.yml` : redémarre le conteneur cible via le socket-proxy.
   - `rollback_image.yml` : revient à la dernière image saine (tag connu).
   - `restore_db.yml` : restaure le dernier dump sain.
4. **`deploy.yml`** (déploiement complet reproductible) et **`reset.yml`** (remise à zéro propre) dans `ansible/`.
5. **Sécurité (piège du sujet)** : le remediator est sur `ops` uniquement, n'expose aucun port public, ses secrets viennent de SOPS, ses droits Docker sont limités par le proxy. Documente ce durcissement.

**✅ Validation (test de bout en bout) :**
```bash
./scripts/demo.sh         # lance trafic normal, puis attaque, puis observe
```
La séquence doit se dérouler **sans main humaine** : attaque → score monte → `/alert` → playbook → IP bannie + restart → transaction de test OK → `recovered`. Mesure le temps (RTO réel) et logge-le.
**→ COMMIT** (remédiation autonome — jalon majeur).

---

## PHASE 8 — Assistant RAG (Ollama + LangChain + Chroma)

**Objectif :** assistant local qui répond sur VOTRE doc, sans privilèges, distinct du remediator.

1. **`ollama`** : de préférence sur le **PC délestage IA**. Modèle `qwen2.5:3b` (ou `llama3.1:8b` si 16 Go dispo sur la machine IA). Embeddings `nomic-embed-text`.
2. **Service `assistant`** :
   - Indexe `docs/` + les README (`knowledge/` monte ces fichiers) dans **Chroma** (persistant, fichier local).
   - `POST /ask` → RAG : récupère les passages, construit le prompt, interroge Ollama, renvoie réponse + sources.
   - `GET /health` vérifie qu'Ollama répond.
3. **Garde-fous (sujet)** : l'assistant **n'a aucun droit** sur Docker ni sur les services ; il **lit** seulement la doc. Il ne doit pas être confondu avec le remediator. Aucun accès privilégié.
4. Petit panneau "Assistant" dans le frontend (optionnel) ou endpoint testable au curl.

**✅ Validation :** `POST /ask` avec "Quelle est la procédure de remédiation d'un DoS ?" renvoie une réponse pertinente citant le runbook correspondant.
**→ COMMIT** (assistant RAG).

---

## PHASE 9 — Attaque (PC Attaquant)

**Objectif :** au moins un scénario crédible, reproductible, à effet observable, dont la remédiation est démontrable.

1. **Scénario principal — DoS applicatif** (`attack/dos_attack.py` ou `locustfile`) : rafale de requêtes sur `/api/pay/transactions` via le WAF → latence p95 et 5xx explosent. Reproductible, paramétrable (durée, concurrence).
2. **Scénarios bonus** (si le temps) :
   - `sqli_probe.py` : injection bloquée par le WAF (montre la défense, **pas** la disponibilité).
   - `bruteforce_auth.py` : rafale de logins → détection SOC + éventuel ban.
3. `attack/README.md` : prérequis (Kali/PC Attaquant), comment lancer, effet attendu, **distinction disponibilité vs compromission** (le sujet insiste : les réponses ne sont pas les mêmes).
4. **Rappel périmètre** : actions **uniquement** sur votre SI fictif et vos machines. Jamais le réseau du campus.

**✅ Validation :** depuis le PC Attaquant connecté à `RESILIENCE-G12`, le DoS déclenche la chaîne complète de la Phase 7.
**→ COMMIT** (scénarios d'attaque).

---

## PHASE 10 — Secrets (SOPS + age)

**Objectif :** aucun secret en clair dans le dépôt, déchiffrement au déploiement.

1. Installe `sops` + `age`. Génère une clé age (stockée **hors dépôt**, partagée dans l'équipe par canal sûr).
2. `.sops.yaml` : règle de chiffrement pour `secrets/*.enc.env`.
3. `secrets/secrets.enc.env` (chiffré) contient : `POSTGRES_PASSWORD`, `JWT_SECRET`, etc.
4. Intègre le déchiffrement dans **Ansible `deploy.yml`** : SOPS décrypte vers un fichier temporaire monté comme secret Docker (`/run/secrets/...`), supprimé après. Jamais écrit en clair dans le dépôt.
5. Vérifie que `git grep` ne trouve **aucun** secret en clair ; mets à jour `.gitignore`.

**✅ Validation :** `make reset` suivi d'un déploiement Ansible monte la stack avec les secrets déchiffrés à la volée ; aucun secret en clair dans `git log`/`git grep`.
**→ COMMIT** (gestion des secrets).

---

## PHASE 11 — Intégration finale, scénario de démo, rejouabilité

**Objectif :** la démo du vendredi doit être **répétable à l'identique** et chronométrable.

1. `scripts/demo.sh` orchestré : état initial (transaction OK) → attaque → détection → remédiation → transaction finale OK, avec pauses et affichages lisibles.
2. `scripts/reset_demo.sh` : remet l'environnement à neuf en < 60 s (via `ansible/reset.yml`).
3. Répète la démo **au moins 10 fois** et logge le RTO à chaque fois. Objectif : 100 % de réussite.
4. Prépare le **Clip Chrono** (≤ 60 s, sans coupe) : attaque → anomalie → réaction → service rétabli.
5. Dashboard : vérifie que l'état AVANT/PENDANT/APRÈS est lisible en un coup d'œil pour le jury.

**✅ Validation :** 10 exécutions consécutives réussies sans intervention humaine ; reset fiable entre chaque.
**→ COMMIT** (démo stabilisée).

---

## PHASE 12 — Documentation (READMEs) + gouvernance

**Objectif :** livrables rédigés, dépôt compréhensible par un tiers, gouvernance reliée à l'archi.

### 12.A README racine (`README.md`)
Doit contenir, dans l'ordre :
1. Titre, pitch du projet (3 lignes).
2. Schéma d'architecture (ASCII + lien image), les 4 réseaux, le flux incident→reprise.
3. Prérequis (Docker Desktop/WSL2, RAM, SOPS/age, Ansible).
4. **Installation en 5 commandes** (clone → clé age → `make build` → déploiement Ansible → `make up`).
5. **Lancer la démo** (`scripts/demo.sh`), **reset** (`scripts/reset_demo.sh`).
6. **Travailler sur un seul service** (profils Compose, branche dédiée).
7. Tableau des services avec ports internes et profils.
8. Accès : frontend (via WAF), Grafana (127.0.0.1:3000), Adminer (127.0.0.1:8081).
9. Structure du dépôt (copie commentée de la section 2).
10. Sécurité (cloisonnement, moindre privilège, secrets).
11. Dépannage (section 13).
12. Contributions de chacun (à compléter par l'équipe).

### 12.B README par microservice
Génère un `README.md` dans **chaque** service (`frontend`, `auth`, `payment-api`, `detector`, `remediator`, `assistant`), structure imposée :
1. Rôle du service (2 lignes).
2. Endpoints (méthode, chemin, auth requise, exemple curl, réponse).
3. Variables d'environnement (tableau : nom, rôle, défaut).
4. Dépendances (services appelés + réseaux).
5. **Lancer seul** (`docker compose --profile <x> up <service>` + ses deps).
6. Tester (commande des tests).
7. Métriques exposées.
8. Points de vigilance / limites.

### 12.C Interface Postgres
Documente **Adminer** dans le README racine et dans le README de `payment-api` : URL `http://127.0.0.1:8081`, système PostgreSQL, serveur `db`, identifiants (depuis SOPS), rappel qu'il n'est **jamais** exposé sur `192.168.137.1`.

### 12.D Gouvernance (`docs/`)
1. `docs/ebios/` : analyse EBIOS RM reliée à l'archi (valeurs métier = service de paiement ; événements redoutés ; scénarios ; mesures = WAF, cloisonnement, remédiation). Objectifs **RTO/RPO** cohérents avec le RTO mesuré en Phase 11.
2. `docs/pca-pra.md` : PCA/PRA de la solution livrée (scénarios couverts, responsabilités, choix de restauration, risques résiduels après reprise).
3. Analyse **NIS2 / DORA** : exigences pertinentes vs obligations non démontrables par un prototype de 4 jours. Démarche conseil : arbitrages, recommandations à une direction, éléments vérifiables.
4. `docs/runbooks/` : procédures (alimentent aussi le RAG de l'assistant).

**✅ Validation :** un évaluateur qui n'a jamais vu le projet peut l'installer et lancer la démo en suivant le seul README racine ; chaque service a son README ; la gouvernance référence des éléments réels de l'archi et le RTO mesuré.
**→ COMMIT** (documentation complète).

---

## 13. Dépannage (à inclure dans le README racine)

- **Un conteneur reste `unhealthy`** : `docker compose logs <svc>` ; vérifier que `/health` renvoie 200 et que les dépendances sont `healthy`.
- **`payment-api` ne joint pas `db`** : vérifier qu'ils partagent bien le réseau `data` et que le mot de passe SOPS est déchiffré.
- **`auth` joint `db` (anormal)** : `auth` ne doit PAS être sur `data` ; corriger le Compose.
- **Prometheus cible `DOWN`** : chemin `/metrics` et port 8000 ; instrumentator bien exposé.
- **Promtail n'envoie rien** : droits sur `/var/lib/docker/containers`, format JSON des logs.
- **RAM saturée** : déplacer `ollama` sur le PC délestage IA ; réduire le modèle à `qwen2.5:3b` ou `phi3:mini`.
- **Démo qui échoue par intermittence** : augmenter les timeouts de vérification du remediator ; fiabiliser le `reset_demo.sh`.

---

## 14. Checklist finale avant rendu (vendredi)

- [ ] `make reset && make up` monte toute la stack, tous `healthy`.
- [ ] Démo rejouée 10×, 100 % de reprise autonome, RTO logué.
- [ ] Clip Chrono ≤ 60 s, sans coupe, exporté en `.mp4`.
- [ ] `git grep` : zéro secret en clair ; `.env`/clés gitignored.
- [ ] README racine + 6 README de services + Adminer documenté.
- [ ] Dossier EBIOS / PCA-PRA / NIS2-DORA reliés à l'archi et au RTO réel.
- [ ] Dossier.pdf (8–12 p.) + Pres.pptx + Code.zip nommés `Workshop2026-M2-G12-*`.
- [ ] Contributions individuelles visibles dans le README et le dossier.
- [ ] Rappel sécurité respecté : attaques limitées au SI fictif, rien sur le réseau campus.

---

### Instructions d'exécution pour Claude Code
- Avance **phase par phase**, dans l'ordre. Ne commence une phase qu'après la validation de la précédente.
- À chaque **→ COMMIT**, arrête-toi, résume ce qui a été fait et **laisse l'équipe rédiger le message et committer**.
- Respecte les **conventions de la section 3** sans exception : c'est ce qui permet le travail parallèle.
- En cas d'ambiguïté, privilégie la **fiabilité de la démo** sur la sophistication.
