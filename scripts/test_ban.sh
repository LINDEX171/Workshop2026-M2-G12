#!/usr/bin/env bash
# Teste le mécanisme de bannissement utilisé par la remédiation (Phase 7) :
#   1. le remediator écrit l'IP dans la liste partagée (infra/waf/banlist/)
#   2. le WAF est rechargé par SIGHUP (même opération que via docker-socket-proxy)
#   3. l'IP reçoit 403, puis on la débannit
set -u
cd "$(dirname "$0")/.."

HOST=$(grep -E '^WAF_BIND_IP=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
BASE="https://${HOST:-127.0.0.1}"
code() { curl -sk -o /dev/null -w '%{http_code}' "$BASE/"; }
fail=0

IP=$(curl -sk "$BASE/api/whoami" | tr -d '\r\n')
echo "IP vue par le WAF : $IP"
[ -n "$IP" ] || { echo "❌ WAF injoignable"; exit 1; }

echo "-> bannissement de $IP"
docker compose exec -T remediator sh -c "echo '$IP 1;' > /var/lib/waf-banlist/test.conf"
docker compose kill -s HUP waf >/dev/null
sleep 3
c=$(code); if [ "$c" = "403" ]; then echo "✅ IP bannie : 403"; else echo "❌ IP non bannie ($c)"; fail=1; fi

echo "-> débannissement"
docker compose exec -T remediator sh -c ": > /var/lib/waf-banlist/test.conf"   # vider plutôt que supprimer (partage Windows)
docker compose kill -s HUP waf >/dev/null
sleep 3
c=$(code); if [ "$c" = "200" ]; then echo "✅ IP débannie : 200"; else echo "❌ toujours bloquée ($c)"; fail=1; fi

exit $fail
