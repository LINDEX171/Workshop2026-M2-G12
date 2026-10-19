#!/usr/bin/env bash
# Génère des secrets de DÉVELOPPEMENT aléatoires dans secrets/*.txt (gitignorés).
# Temporaire : en Phase 10, ces fichiers sont produits par SOPS au déploiement.
# Usage : ./scripts/init_dev_secrets.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

# 64 caractères hexadécimaux, sans retour à la ligne (ni \r sous Windows)
rand() { openssl rand -hex 32 | tr -d '\r\n'; }

for name in pg_password payuser_password auth_db_admin_password authuser_password \
            operator_password jwt_secret grafana_admin_password; do
  f="secrets/$name.txt"
  if [ -s "$f" ] && [ "${1:-}" != "--force" ]; then
    echo "= $f existe déjà (--force pour régénérer)"
  else
    rand > "$f"
    echo "+ $f généré"
  fi
done
