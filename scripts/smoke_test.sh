#!/usr/bin/env bash
# Test fonctionnel du métier (Phase 2), exécuté depuis le conteneur payment-api :
#   login -> transaction avec token (200) -> sans token (401) -> token forgé (401)
#   -> relecture de la transaction -> cohérence des soldes.
set -u
cd "$(dirname "$0")/.."

OPERATOR_PASSWORD="$(cat secrets/operator_password.txt)"

docker compose exec -T -e OPERATOR_PASSWORD="$OPERATOR_PASSWORD" payment-api python - <<'PY'
import json
import os
import urllib.error
import urllib.request

AUTH = "http://auth:8000"
PAY = "http://localhost:8000"


def call(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


fail = False


def check(label, ok, detail=""):
    global fail
    print(("✅ " if ok else "❌ ") + label + (f"  ->  {detail}" if detail != "" else ""))
    fail = fail or not ok


s, b = call("POST", f"{AUTH}/login", {"username": "operator", "password": os.environ["OPERATOR_PASSWORD"]})
check("login operator (200)", s == 200, s)
token = (b or {}).get("token")

s, _ = call("POST", f"{AUTH}/login", {"username": "operator", "password": "mauvais"})
check("login avec mauvais mot de passe refusé (401)", s == 401, s)

s, before = call("GET", f"{PAY}/accounts", token=token)
check("GET /accounts (200)", s == 200, before)

s, b = call("POST", f"{PAY}/transactions", {"dst": 2, "amount": 10}, token=token)
check("transaction avec token acceptée (200)", s == 200 and (b or {}).get("status") == "accepted", b)
tx_id = (b or {}).get("id")

s, _ = call("POST", f"{PAY}/transactions", {"dst": 2, "amount": 10})
check("transaction sans token refusée (401)", s == 401, s)

s, _ = call("POST", f"{PAY}/transactions", {"dst": 2, "amount": 10}, token="faux.token.jwt")
check("transaction avec token forgé refusée (401)", s == 401, s)

s, b = call("GET", f"{PAY}/transactions/{tx_id}", token=token)
check("relecture de la transaction en base", s == 200 and (b or {}).get("id") == tx_id, b)

s, after = call("GET", f"{PAY}/accounts", token=token)
if isinstance(before, list) and isinstance(after, list):
    bal_before = {a["id"]: float(a["balance"]) for a in before}
    bal_after = {a["id"]: float(a["balance"]) for a in after}
    check("compte 1 débité de 10", round(bal_before[1] - bal_after[1], 2) == 10)
    check("compte 2 crédité de 10", round(bal_after[2] - bal_before[2], 2) == 10)
    check("somme des soldes inchangée (cohérence)",
          round(sum(bal_before.values()), 2) == round(sum(bal_after.values()), 2))

raise SystemExit(1 if fail else 0)
PY
