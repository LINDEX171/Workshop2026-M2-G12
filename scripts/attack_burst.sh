#!/usr/bin/env bash
# Lance le DoS de démo depuis un conteneur jetable branché sur le réseau `public`
# (comme un client externe). Sert à tester la Phase 7 et la Phase 9.
# Usage : ./scripts/attack_burst.sh [duree_s] [concurrence]
set -euo pipefail
cd "$(dirname "$0")/.."

DURATION=${1:-45}
CONCURRENCY=${2:-60}
PROJECT=$(grep -E '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
PROJECT=${PROJECT:-resilience-g12}
NET="${PROJECT}_public"

echo "== DoS applicatif via le WAF (réseau $NET) =="
MSYS_NO_PATHCONV=1 docker run --rm --network "$NET" \
  -v "$(pwd -W)/attack:/attack:ro" \
  python:3.12-slim \
  python /attack/dos_attack.py --target https://waf:8443 \
    --duration "$DURATION" --concurrency "$CONCURRENCY"
