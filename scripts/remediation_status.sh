#!/usr/bin/env bash
# État de la remédiation : journal des événements, signatures bannies, santé payment-api.
set -u
cd "$(dirname "$0")/.."

echo "== Journal des remédiations (du plus récent au plus ancien) =="
docker compose exec -T remediator python -c "import urllib.request,json; \
print(json.dumps(json.loads(urllib.request.urlopen('http://localhost:8000/events').read()), indent=2, ensure_ascii=False))"

echo
echo "== Signatures bannies au WAF =="
grep -rhv '^#' infra/waf/banlist-ua/ 2>/dev/null | grep -v '^\s*$' || echo "(aucune)"

echo
echo "== Santé payment-api =="
docker compose exec -T detector python -c "import urllib.request; \
print(urllib.request.urlopen('http://payment-api:8000/health').read().decode())" 2>/dev/null \
  || echo "payment-api injoignable"
