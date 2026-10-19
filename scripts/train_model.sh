#!/usr/bin/env bash
# Entraîne le modèle de détection (Isolation Forest) sur du trafic NORMAL :
#   1. démarre le load-generator (trafic opérateur réaliste, via le WAF)
#   2. attend MINUTES minutes pour constituer l'historique dans Prometheus
#   3. entraîne dans le conteneur detector -> services/detector/model/{model.pkl,report.json}
#      (le detector recharge le nouveau modèle tout seul, sans redémarrage)
#
# Usage : ./scripts/train_model.sh [MINUTES] [--no-wait]
#   MINUTES    fenêtre d'historique utilisée (défaut 25)
#   --no-wait  entraîne tout de suite sur l'historique déjà présent
set -euo pipefail
cd "$(dirname "$0")/.."

MINUTES=25
WAIT=1
for arg in "$@"; do
  case "$arg" in
    --no-wait) WAIT=0 ;;
    *) MINUTES="$arg" ;;
  esac
done

echo "== Démarrage du trafic normal (load-generator) =="
docker compose --profile attack up -d load-generator

if [ "$WAIT" = "1" ]; then
  echo "== Collecte de $MINUTES min de trafic normal (ne lancez AUCUNE attaque pendant ce temps) =="
  for ((left = MINUTES; left > 0; left--)); do
    printf '\r   %2d min restantes…' "$left"
    sleep 60
  done
  printf '\r   collecte terminée.          \n'
fi

echo "== Entraînement =="
docker compose exec -T detector python -m app.train --minutes "$MINUTES"
