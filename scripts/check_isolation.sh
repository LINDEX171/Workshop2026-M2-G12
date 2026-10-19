#!/usr/bin/env bash
# Vérifie le cloisonnement réseau (argument cyber) :
#   - auth NE DOIT PAS joindre db:5432 (pas sur le réseau data)
#   - payment-api DOIT joindre db:5432
#   - db ne publie aucun port
set -u
cd "$(dirname "$0")/.."

probe() {  # probe <service> <host> <port>
  docker compose exec -T "$1" python -c \
    "import socket; socket.create_connection(('$2', $3), 2)" >/dev/null 2>&1
}
fail=0

if probe auth db 5432; then echo "❌ auth joint db:5432 (ANORMAL)"; fail=1
else echo "✅ auth ne joint pas db:5432"; fi

if probe payment-api db 5432; then echo "✅ payment-api joint db:5432"
else echo "❌ payment-api ne joint pas db:5432"; fail=1; fi

# Un port publié apparaît sous la forme "IP:port->5432/tcp" (un simple "5432/tcp" reste interne)
if docker compose ps db --format '{{.Ports}}' | grep -q -- '->'; then echo "❌ db publie un port"; fail=1
else echo "✅ db ne publie aucun port"; fi

exit $fail
