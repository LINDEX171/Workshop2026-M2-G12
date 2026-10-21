# payment-api

## 1. Rôle
Cœur métier : comptes et transactions. Chaque transaction exige un jeton valide (vérifié
auprès de `auth`) et s'exécute de façon **atomique** (débit + crédit + journalisation).

## 2. Endpoints
| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| POST | `/transactions` | Bearer | Virement `{src?,dst,amount}` ; 200 accepté, 422 rejeté (solde) |
| GET | `/transactions` | Bearer | N dernières transactions |
| GET | `/transactions/{id}` | Bearer | Une transaction |
| GET | `/accounts` | Bearer | Comptes et soldes |
| GET | `/health` | non | 200 si db **et** auth OK, sinon 503 |
| GET | `/metrics` | non | Format Prometheus (interne) |

```bash
curl -sk -X POST https://localhost/api/pay/transactions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"dst":2,"amount":10}'   # -> {"id":...,"status":"accepted"}
curl -sk -X POST https://localhost/api/pay/transactions -d '{"dst":2,"amount":10}'   # -> 401 sans jeton
```

## 3. Variables d'environnement
| Nom | Rôle | Défaut |
|---|---|---|
| `SERVICE_NAME` | Nom du service | payment-api |
| `AUTH_URL` | URL interne de auth | http://auth:8000 |
| `DB_HOST/PORT/NAME/USER` | Connexion à db | db / 5432 / payments / payuser |
| `DEFAULT_SRC_ACCOUNT` | Compte débité par défaut | 1 |
| secret `payuser_password` | lu dans `/run/secrets/` | — |

## 4. Dépendances
`db` (réseau `data`) et `auth` (réseau `app`). `/health` reflète les deux.

## 5. Lancer seul
```bash
docker compose --profile core up -d db auth-db auth payment-api
```

## 6. Tester
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/payment-api /tmp/s; cd /tmp/s; pip install -q -r requirements-dev.txt; python -m pytest -q'
```

## 7. Métriques (métier)
`tx_total{status}`, `tx_failed_total`, `tx_latency_seconds` (histogramme) + métriques HTTP.

## 8. Vigilance / limites
- Le rôle SQL `payuser` ne peut ni supprimer ni modifier une transaction (journal append-only).
- La base `db` n'a **aucun** port publié ; l'accès admin passe par **Adminer** (http://127.0.0.1:8081,
  serveur `db`, base `payments`), jamais exposé sur `192.168.137.1`.
