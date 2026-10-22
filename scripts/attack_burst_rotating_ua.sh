#!/usr/bin/env bash
# Lance le DoS de démo à signature TOURNANTE depuis un conteneur jetable branché sur le
# réseau `public` (comme un client externe). Variante de attack_burst.sh pour tester la
# limite de la remédiation (ban d'UNE seule signature) face à un attaquant qui en fait
# varier plusieurs. Usage : ./scripts/attack_burst_rotating_ua.sh [duree_s] [concurrence] [--rotate-per-request]
set -euo pipefail
cd "$(dirname "$0")/.."

DURATION=${1:-45}
CONCURRENCY=${2:-60}
EXTRA_ARG=${3:-}
PROJECT=$(grep -E '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
PROJECT=${PROJECT:-resilience-g12}
NET="${PROJECT}_public"

echo "== DoS applicatif à signature tournante via le WAF (réseau $NET) =="
MSYS_NO_PATHCONV=1 docker run --rm --network "$NET" \
  -v "$(pwd -W)/attack:/attack:ro" \
  python:3.12-slim \
  python /attack/dos_attack_rotating_ua.py --target https://waf:8443 \
    --duration "$DURATION" --concurrency "$CONCURRENCY" $EXTRA_ARG
