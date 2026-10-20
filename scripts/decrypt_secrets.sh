#!/usr/bin/env bash
# Déchiffre secrets/secrets.enc.env (SOPS+age) vers les secrets Docker secrets/*.txt.
# Appelé au déploiement (ansible/deploy.yml). Les *.txt sont gitignorés (jamais en clair au dépôt).
# Prérequis : clé privée age dans ~/.config/sops/age/keys.txt.
# Usage : ./scripts/decrypt_secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
[ -f secrets/secrets.enc.env ] || { echo "secrets/secrets.enc.env absent"; exit 1; }

count=0
while IFS='=' read -r key val; do
  [ -z "$key" ] && continue
  name=$(printf '%s' "$key" | tr '[:upper:]' '[:lower:]')
  printf '%s' "$val" > "secrets/${name}.txt"
  count=$((count + 1))
done < <(sops --decrypt --input-type dotenv --output-type dotenv secrets/secrets.enc.env)

echo "+ $count secrets déchiffrés vers secrets/*.txt"
