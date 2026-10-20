#!/usr/bin/env bash
# Démo rejouable et chronométrable : état initial -> attaque -> détection -> remédiation
# automatique -> preuve de reprise. Conçue pour le jury et pour le clip chrono (<= 60 s).
# Écrit le RTO mesuré dans /tmp/demo_rto.txt (exploité par demo_replay.sh).
# Usage : ./scripts/demo.sh
set -u
cd "$(dirname "$0")/.."

HOST=$(grep -E '^WAF_BIND_IP=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
HOST=${HOST:-127.0.0.1}
BASE="https://$HOST"
PROJECT=$(grep -E '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
PROJECT=${PROJECT:-resilience-g12}
NET="${PROJECT}_public"
PASSWORD=$(cat secrets/operator_password.txt)
ATTACK_NAME=resilience-demo-attack

say()   { echo; echo "===== $* ====="; }
rtxt()  { docker compose exec -T remediator python -c "import urllib.request,json;print(sum(1 for e in json.load(urllib.request.urlopen('http://localhost:8000/events?limit=500')) if e.get('status')=='recovered'))" 2>/dev/null || echo 0; }

transaction() {  # login + virement via le WAF ; affiche le résultat
  local t
  t=$(curl -sk -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
        -d "{\"username\":\"operator\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  curl -sk -X POST "$BASE/api/pay/transactions" -H "Authorization: Bearer $t" \
        -H 'Content-Type: application/json' -d '{"dst":2,"amount":5}'
}

rm -f /tmp/demo_rto.txt

say "ÉTAT INITIAL (AVANT)"
echo -n "Transaction de contrôle : "; transaction; echo

say "ATTAQUE — DoS applicatif depuis le réseau public (signature ResilienceDoS/1.0)"
before=$(rtxt)
start=$(date +%s)
docker rm -f "$ATTACK_NAME" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker run -d --rm --name "$ATTACK_NAME" --network "$NET" \
  -v "$(pwd -W)/attack:/attack:ro" python:3.12-slim \
  python /attack/dos_attack.py --target https://waf:8443 --duration 40 --concurrency 60 >/dev/null
echo "Attaque en cours…"

say "DÉTECTION ML + REMÉDIATION AUTOMATIQUE (PENDANT)"
rto=""
for _ in $(seq 1 90); do
  if [ "$(rtxt)" -gt "$before" ]; then rto=$(( $(date +%s) - start )); break; fi
  sleep 2
done
docker rm -f "$ATTACK_NAME" >/dev/null 2>&1   # on coupe l'attaque dès la reprise

if [ -n "$rto" ]; then
  echo "✅ Reprise vérifiée automatiquement — RTO ≈ ${rto} s"
  echo "RTO=${rto}" > /tmp/demo_rto.txt
else
  echo "❌ Reprise non constatée dans le délai imparti"
fi

say "PREUVE DE REPRISE (APRÈS)"
echo -n "Nouvelle transaction : "; transaction; echo
echo
echo "Journal de remédiation :"
docker compose exec -T remediator python -c "import urllib.request,json;[print('  ',e['ts'][11:19],e['type'],'|',e.get('action') or '-','|',e['status']) for e in list(reversed(json.load(urllib.request.urlopen('http://localhost:8000/events?limit=6'))))]" 2>/dev/null

[ -n "$rto" ]
