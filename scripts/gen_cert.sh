#!/usr/bin/env bash
# Génère le certificat TLS du WAF dans infra/waf/certs/ (gitignoré).
#   - mkcert installé : certificat signé par une autorité locale -> AUCUN avertissement
#     navigateur (exécuter une fois `mkcert -install` sur le PC qui affiche la démo)
#   - sinon : certificat auto-signé (avertissement « connexion non privée »)
# Usage : ./scripts/gen_cert.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=infra/waf/certs
mkdir -p "$DIR"

if [ -s "$DIR/server.crt" ] && [ "${1:-}" != "--force" ]; then
  echo "= $DIR/server.crt existe déjà (--force pour régénérer)"
  exit 0
fi

if command -v mkcert >/dev/null 2>&1; then
  mkcert -cert-file "$DIR/server.crt" -key-file "$DIR/server.key" \
    localhost 127.0.0.1 192.168.137.1 resilience-g12
  echo "+ certificat mkcert généré (reconnu par les navigateurs après 'mkcert -install')"
else
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$DIR/server.key" -out "$DIR/server.crt" \
    -subj "/CN=resilience-g12" \
    -addext "subjectAltName=DNS:localhost,DNS:resilience-g12,IP:127.0.0.1,IP:192.168.137.1" \
    2>/dev/null
  echo "+ certificat auto-signé généré (installer mkcert pour supprimer l'avertissement)"
fi
