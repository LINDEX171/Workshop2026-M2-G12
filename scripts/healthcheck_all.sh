#!/usr/bin/env bash
# Interroge /health de chaque microservice depuis son propre conteneur,
# puis affiche l'état Docker de tous les conteneurs de la stack.
set -u
cd "$(dirname "$0")/.."

SERVICES=(auth payment-api detector remediator assistant)
PROBE="import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health', timeout=3).read().decode())"
fail=0

echo "== /health des microservices =="
for svc in "${SERVICES[@]}"; do
  if [ -z "$(docker compose ps -q --status running "$svc" 2>/dev/null)" ]; then
    echo "⚪ $svc : non démarré (profil inactif ?)"
    continue
  fi
  if out=$(docker compose exec -T "$svc" python -c "$PROBE" 2>/dev/null); then
    echo "✅ $svc : $out"
  else
    echo "❌ $svc : /health KO"
    fail=1
  fi
done

echo
echo "== État des conteneurs =="
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
exit $fail
