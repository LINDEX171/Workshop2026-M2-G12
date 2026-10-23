#!/usr/bin/env bash
# Génère des secrets de DÉVELOPPEMENT aléatoires dans secrets/*.txt (gitignorés).
# Temporaire : en Phase 10, ces fichiers sont produits par SOPS au déploiement.
# Usage : ./scripts/init_dev_secrets.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

# 64 caractères hexadécimaux, sans retour à la ligne (ni \r sous Windows)
rand() { openssl rand -hex 32 | tr -d '\r\n'; }

for name in pg_password payuser_password auth_db_admin_password authuser_password \
            operator_password admin_password jwt_secret grafana_admin_password; do
  f="secrets/$name.txt"
  if [ -s "$f" ] && [ "${1:-}" != "--force" ]; then
    echo "= $f existe déjà (--force pour régénérer)"
  else
    rand > "$f"
    echo "+ $f généré"
  fi
done

# smtp_password : secret RÉEL (mot de passe d'application Gmail), pas une valeur aléatoire.
# On crée juste un fichier vide s'il manque (pour que Docker secrets ne bloque pas) ;
# à remplir à la main, puis à chiffrer avec ./scripts/encrypt_secrets.sh.
if [ ! -f secrets/smtp_password.txt ]; then
  : > secrets/smtp_password.txt
  echo "+ secrets/smtp_password.txt créé (vide — colle ton App Password Gmail dedans)"
fi
