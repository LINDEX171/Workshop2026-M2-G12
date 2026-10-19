#!/bin/sh
# Init de la base d'authentification (service auth-db, réseau auth-data).
# L'utilisateur `operator` est créé au démarrage du service auth à partir
# du secret operator_password (aucun hash ni mot de passe dans le dépôt).
# Pas de "set -u" : le script peut être sourcé par docker-entrypoint.sh
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v dbname="$POSTGRES_DB" \
  -v authuser_pw="$(cat /run/secrets/authuser_password)" \
  -f /docker-entrypoint-initdb.d/sql/01_schema_auth.sql
