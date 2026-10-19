#!/usr/bin/env bash
# Vérifie le cloisonnement réseau (argument cyber) :
#   - auth NE DOIT PAS joindre db:5432 (pas sur le réseau data)
#   - payment-api DOIT joindre db:5432
#   - auth DOIT joindre auth-db:5432, payment-api NE DOIT PAS
#   - db et auth-db ne publient aucun port
set -u
cd "$(dirname "$0")/.."

probe() {  # probe <service> <host> <port>
  docker compose exec -T "$1" python -c \
    "import socket; socket.create_connection(('$2', $3), 2)" >/dev/null 2>&1
}
fail=0

expect_blocked() {  # expect_blocked <service> <host>
  if probe "$1" "$2" 5432; then echo "❌ $1 joint $2:5432 (ANORMAL)"; fail=1
  else echo "✅ $1 ne joint pas $2:5432"; fi
}
expect_open() {  # expect_open <service> <host>
  if probe "$1" "$2" 5432; then echo "✅ $1 joint $2:5432"
  else echo "❌ $1 ne joint pas $2:5432"; fail=1; fi
}

expect_blocked auth db
expect_open    payment-api db
expect_open    auth auth-db
expect_blocked payment-api auth-db

# Un port publié apparaît sous la forme "IP:port->5432/tcp" (un simple "5432/tcp" reste interne)
for svc in db auth-db; do
  if docker compose ps "$svc" --format '{{.Ports}}' | grep -q -- '->'; then echo "❌ $svc publie un port"; fail=1
  else echo "✅ $svc ne publie aucun port"; fi
done

exit $fail
