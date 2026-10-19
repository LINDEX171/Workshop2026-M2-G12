#!/bin/sh
# Init de la base des paiements (exécuté une seule fois, volume vide).
# Le mot de passe du rôle applicatif est lu depuis le secret Docker, jamais en dur.
# Pas de "set -u" : le script peut être sourcé par docker-entrypoint.sh
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v dbname="$POSTGRES_DB" \
  -v payuser_pw="$(cat /run/secrets/payuser_password)" \
  -f /docker-entrypoint-initdb.d/sql/02_schema_payments.sql
