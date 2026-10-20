#!/usr/bin/env bash
# Chiffre les secrets de developpement (secrets/*.txt) dans secrets/secrets.enc.env (SOPS+age).
# Le fichier chiffré EST versionné ; les *.txt en clair ne le sont jamais.
# Prérequis : ./scripts/init_dev_secrets.sh puis ./scripts/init_age_key.sh.
# Usage : ./scripts/encrypt_secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
[ -s "$SOPS_AGE_KEY_FILE" ] || { echo "Clé age absente : lancer d'abord ./scripts/init_age_key.sh"; exit 1; }

# Fichier clair temporaire DANS secrets/ (gitignoré) : son nom correspond à la règle .sops.yaml
PLAIN=secrets/secrets.plain.env
trap 'rm -f "$PLAIN"' EXIT

# dotenv en clair à partir des secrets individuels : NOM_FICHIER_MAJ=valeur
: > "$PLAIN"
for f in secrets/*.txt; do
  name=$(basename "$f" .txt | tr '[:lower:]' '[:upper:]')
  printf '%s=%s\n' "$name" "$(cat "$f")" >> "$PLAIN"
done

sops --encrypt --input-type dotenv --output-type dotenv "$PLAIN" > secrets/secrets.enc.env
echo "+ secrets/secrets.enc.env chiffré ($(wc -l < "$PLAIN") secrets)"
