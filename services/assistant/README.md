# assistant

## 1. Rôle
Assistant documentaire RAG : répond aux questions sur la doc interne, en local, via Ollama.
**Lecture seule** — aucun accès Docker ni aux services (à ne pas confondre avec le remediator).

## 2. Endpoints
| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| POST | `/ask` | non | `{question}` → `{answer, sources}` (RAG) |
| POST | `/reindex` | non (interne) | Réindexe la doc (non exposé par le WAF) |
| GET | `/health` | non | 200 si Ollama répond, taille de l'index |
| GET | `/metrics` | non | Format Prometheus (interne) |

```bash
curl -sk -X POST https://localhost/api/assistant/ask -H 'Content-Type: application/json' \
  -d '{"question":"Quelle est la procédure de remédiation d'\''un DoS ?"}'
```

## 3. Variables d'environnement
| Nom | Rôle | Défaut |
|---|---|---|
| `OLLAMA_URL` | Serveur Ollama | http://ollama:11434 |
| `OLLAMA_MODEL` | LLM de réponse (≤ 8 Md) | qwen2.5:3b (démo : 1.5b) |
| `EMBED_MODEL` | Modèle d'embeddings | nomic-embed-text |
| `KNOWLEDGE_DIR` | Doc indexée (lecture seule) | /app/knowledge |
| `CHROMA_DIR` | Base vectorielle (tmpfs) | /tmp/chroma |
| `CHUNK_SIZE`/`CHUNK_OVERLAP`/`TOP_K` | Paramètres RAG | 500 / 80 / 3 |
| `NUM_PREDICT`/`NUM_CTX` | Longueur max de la réponse / fenêtre de contexte (latence CPU) | 160 / 2048 |
| `HISTORY_TURNS` | Échanges précédents gardés dans le prompt | 2 |
| `KEEP_ALIVE` | Durée de maintien du LLM en RAM (`-1` = toujours) | -1 |

## 4. Dépendances
`ollama` (réseau `ops`) ; `app` pour être appelé via le WAF. Doc montée depuis `docs/` + `README.md`.

## 5. Lancer seul
```bash
docker compose --profile ai up -d ollama assistant
./scripts/pull_models.sh   # modèles + indexation
```

## 6. Tester
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/services:/src:ro" python:3.12-slim \
  sh -c 'cp -r /src/assistant /tmp/s; cd /tmp/s; pip install -q fastapi "uvicorn[standard]" pydantic-settings httpx prometheus-fastapi-instrumentator structlog pytest; python -m pytest -q'
```

## 7. Métriques
`assistant_ask_total{result}`, `assistant_ask_seconds`.

## 8. Vigilance / limites
- Index reconstruit au démarrage ; relancer `/reindex` après modification de la doc.
- Qualité bornée par un petit modèle local. Détails : [docs/assistant-rag.md](../../docs/assistant-rag.md).
