#!/usr/bin/env bash
# Lance un script d'attaque depuis un conteneur jetable branché sur le réseau `public`
# (comme un client externe). Cible le WAF interne.
# Usage : ./scripts/attack.sh <script.py> [args...]
#   ./scripts/attack.sh sqli_probe.py
#   ./scripts/attack.sh bruteforce_auth.py --attempts 60
set -euo pipefail
cd "$(dirname "$0")/.."

SCRIPT=${1:?"usage: attack.sh <script.py> [args...]"}
shift || true
PROJECT=$(grep -E '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
PROJECT=${PROJECT:-resilience-g12}
NET="${PROJECT}_public"

echo "== $SCRIPT via le WAF (réseau $NET) =="
MSYS_NO_PATHCONV=1 docker run --rm --network "$NET" \
  -v "$(pwd -W)/attack:/attack:ro" \
  python:3.12-slim \
  python "/attack/$SCRIPT" --target https://waf:8443 "$@"
