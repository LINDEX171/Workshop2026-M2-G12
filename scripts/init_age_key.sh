#!/usr/bin/env bash
# Génère une paire de clés age (si absente) et inscrit la clé PUBLIQUE dans .sops.yaml.
# La clé PRIVÉE est stockée HORS dépôt : ~/.config/sops/age/keys.txt
# (à partager dans l'équipe par un canal sûr, jamais dans Git).
# Usage : ./scripts/init_age_key.sh
set -euo pipefail
cd "$(dirname "$0")/.."

KEYFILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
mkdir -p "$(dirname "$KEYFILE")"

command -v age-keygen >/dev/null || {
  echo "age-keygen introuvable : installer age et ROUVRIR Git Bash (PATH)"; exit 1
}

if [ ! -s "$KEYFILE" ]; then
  age-keygen -o "$KEYFILE"
  echo "+ clé age générée : $KEYFILE"
else
  echo "= clé age existante : $KEYFILE"
fi

PUB=$(age-keygen -y "$KEYFILE")
echo "  clé publique : $PUB"

# Remplace la ligne `age: ...` de .sops.yaml par la clé publique réelle
sed -i "s|^    age: age1.*|    age: $PUB|" .sops.yaml
echo "+ .sops.yaml mis à jour avec la clé publique"
