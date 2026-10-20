#!/usr/bin/env bash
# Pose une question à l'assistant RAG (depuis le conteneur, sans exposition publique).
# Usage : ./scripts/assistant_ask.sh "Quelle est la procédure de remédiation d'un DoS ?"
set -u
cd "$(dirname "$0")/.."

Q=${1:-"Quelle est la procédure de remédiation d'un DoS ?"}
docker compose exec -T assistant python - "$Q" <<'PY'
import json, sys, urllib.request
q = sys.argv[1]
req = urllib.request.Request("http://localhost:8000/ask", method="POST",
                             data=json.dumps({"question": q}).encode(),
                             headers={"Content-Type": "application/json"})
r = json.loads(urllib.request.urlopen(req, timeout=120).read())
print("Q:", q)
print("\nRéponse:\n" + r["answer"])
print("\nSources:", ", ".join(r["sources"]) or "(aucune)")
PY
