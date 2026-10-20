#!/usr/bin/env bash
# Télécharge les modèles Ollama (LLM + embeddings) puis (ré)indexe la doc de l'assistant.
# À lancer une fois après le premier démarrage ; les modèles sont ensuite persistés.
# Usage : ./scripts/pull_models.sh
set -euo pipefail
cd "$(dirname "$0")/.."

LLM=$(grep -E '^OLLAMA_MODEL=' .env 2>/dev/null | cut -d= -f2 | awk '{print $1}')
LLM=${LLM:-qwen2.5:3b}
EMBED=nomic-embed-text

echo "== Téléchargement du LLM $LLM (plusieurs minutes la 1re fois) =="
docker compose exec -T ollama ollama pull "$LLM"

echo "== Téléchargement des embeddings $EMBED =="
docker compose exec -T ollama ollama pull "$EMBED"

echo "== Modèles disponibles =="
docker compose exec -T ollama ollama list

echo "== Indexation de la documentation (assistant) =="
docker compose exec -T assistant python -c "import urllib.request; \
print(urllib.request.urlopen(urllib.request.Request('http://localhost:8000/reindex', method='POST'), timeout=120).read().decode())"
