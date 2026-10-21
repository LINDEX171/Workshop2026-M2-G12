# detector

## 1. Rôle
Détection d'anomalies par Machine Learning (Isolation Forest + enveloppe statistique) sur
les métriques Prometheus. Alerte le remediator et agrège l'état de la plateforme pour le dashboard.

## 2. Endpoints
| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| GET | `/score` | non | Score courant, seuil, features, top features |
| GET | `/status` | non | Vue agrégée (phase AVANT/PENDANT/APRÈS, services, événements) |
| GET | `/health` | non | 200 si Prometheus répond, état du modèle |
| GET | `/metrics` | non | Format Prometheus (interne) |

```bash
curl -sk https://localhost/api/status | head -c 300
docker compose exec -T detector python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:8000/score').read().decode())"
```

## 3. Variables d'environnement
| Nom | Rôle | Défaut |
|---|---|---|
| `PROMETHEUS_URL` | Source des features | http://prometheus:9090 |
| `REMEDIATOR_URL` | Destination des alertes | http://remediator:8000 |
| `DETECTOR_INTERVAL_SEC` | Période de calcul | 10 |
| `DETECTOR_THRESHOLD` | `auto` (calibré) ou valeur fixe | auto |
| `ALERT_COOLDOWN_SEC` | Délai anti-rafale entre alertes | 60 |
| `MODEL_PATH` | Modèle entraîné | /app/model/model.pkl |
| `AUTH_URL`/`PAYMENT_URL`/`ASSISTANT_URL` | Sondés par `/status` | URLs internes |

## 4. Dépendances
Prometheus et remediator (réseau `ops`) ; `app` pour servir `/status` au frontend. Modèle
monté depuis `services/detector/model/` (régénéré par `scripts/train_model.sh`).

## 5. Lancer seul
```bash
docker compose --profile obs up -d prometheus
docker compose --profile ai up -d detector
```

## 6. Tester
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/detector /tmp/s; cd /tmp/s; pip install -q -r requirements-dev.txt; python -m pytest -q'
```

## 7. Métriques
`anomaly_score`, `anomaly_threshold`, `anomaly_component_score{component}`,
`anomaly_detected_total{type}`, `detector_feature{feature}`.

## 8. Vigilance / limites
- Modèle appris sur du trafic **normal** : ne rien attaquer pendant `scripts/train_model.sh`.
- Isolation Forest sature → enveloppe statistique en complément. Détails et limites :
  [docs/detection-ml.md](../../docs/detection-ml.md).
