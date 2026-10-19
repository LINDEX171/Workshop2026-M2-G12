#!/usr/bin/env bash
# Vérifie le WAF depuis le PC Hôte (comme un vrai client) :
# routage, HTTPS, authentification de bout en bout, blocage SQLi/XSS, surfaces masquées.
set -u
cd "$(dirname "$0")/.."

HOST=$(grep -E '^WAF_BIND_IP=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
HOST=${HOST:-127.0.0.1}
BASE="https://$HOST"
fail=0

code() { curl -sk -o /dev/null -w '%{http_code}' "$@"; }
expect() {  # expect <libellé> <code attendu> <code obtenu>
  if [ "$3" = "$2" ]; then echo "✅ $1 ($3)"; else echo "❌ $1 : attendu $2, obtenu $3"; fail=1; fi
}

echo "== Routage et HTTPS ($BASE) =="
expect "frontend servi via le WAF"           200 "$(code "$BASE/")"
expect "HTTP redirigé vers HTTPS"            301 "$(code "http://$HOST/")"
expect "agrégateur /api/status"              200 "$(code "$BASE/api/status")"
expect "route /api inconnue"                 404 "$(code "$BASE/api/inconnue")"

echo
echo "== Parcours métier via le WAF =="
PASSWORD=$(cat secrets/operator_password.txt)
TOKEN=$(curl -sk -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"operator\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then echo "✅ login via le WAF"; else echo "❌ login via le WAF"; fail=1; fi
expect "transaction avec token" 200 "$(code -X POST "$BASE/api/pay/transactions" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"dst":2,"amount":1}')"
expect "transaction sans token" 401 "$(code -X POST "$BASE/api/pay/transactions" \
  -H 'Content-Type: application/json' -d '{"dst":2,"amount":1}')"

echo
echo "== Attaques bloquées par ModSecurity (OWASP CRS) =="
expect "injection SQL"   403 "$(code "$BASE/api/pay/transactions?id=1%27%20OR%20%271%27%3D%271")"
expect "XSS"             403 "$(code "$BASE/api/pay/accounts?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E")"
expect "path traversal"  403 "$(code "$BASE/api/pay/accounts?file=..%2F..%2F..%2Fetc%2Fpasswd")"

echo
echo "== Surfaces internes masquées =="
expect "/api/pay/metrics"  404 "$(code "$BASE/api/pay/metrics")"
expect "/api/auth/docs"    404 "$(code "$BASE/api/auth/docs")"

echo
echo "IP vue par le WAF : $(curl -sk "$BASE/api/whoami")"
exit $fail
