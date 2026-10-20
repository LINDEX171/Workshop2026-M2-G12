# auth

## 1. Rôle
Service d'authentification : connexion des opérateurs, émission et validation de jetons JWT.
Possède sa **propre** base (`auth-db`, réseau isolé `auth-data`) — il ne joint jamais la base des paiements.

## 2. Endpoints
| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| POST | `/login` | non | Vérifie le mot de passe (bcrypt), renvoie un JWT |
| GET | `/verify` | Bearer | Valide le jeton, renvoie les claims |
| GET | `/me` | Bearer | Utilisateur courant |
| GET | `/health` | non | 200 si la base répond, sinon 503 |
| GET | `/metrics` | non | Format Prometheus (interne) |

```bash
TOKEN=$(curl -sk -X POST https://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"<cat secrets/operator_password.txt>"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -sk https://localhost/api/auth/verify -H "Authorization: Bearer $TOKEN"
# -> {"valid":true,"sub":"operator","role":"operator","exp":...}
```

## 3. Variables d'environnement
| Nom | Rôle | Défaut |
|---|---|---|
| `SERVICE_NAME` | Nom du service | auth |
| `JWT_ALG` | Algo de signature | HS256 |
| `JWT_EXPIRE_MIN` | Durée de vie du jeton (min) | 30 |
| `AUTH_DB_HOST/PORT/NAME/USER` | Connexion à auth-db | auth-db / 5432 / authdb / authuser |
| `OPERATOR_USERNAME` | Compte seedé au démarrage | operator |
| secrets `jwt_secret`, `authuser_password`, `operator_password` | lus dans `/run/secrets/` | — |

## 4. Dépendances
`auth-db` (réseau `auth-data`). Réseau `app` pour être appelé par payment-api et le WAF.

## 5. Lancer seul
```bash
docker compose --profile core up -d auth-db auth
```

## 6. Tester
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/auth /tmp/s; cd /tmp/s; pip install -q -r requirements-dev.txt; python -m pytest -q'
```

## 7. Métriques
`auth_login_total{result="success|failure"}` + métriques HTTP standard.

## 8. Vigilance / limites
- Les échecs de login sont journalisés avec l'IP (vue SOC) ; vérification à temps constant.
- Base dédiée = cloisonnement fort ; en contrepartie, un conteneur Postgres de plus.
