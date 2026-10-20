# Assistant RAG — dossier technique

Service `assistant` (Phase 8) : répond aux questions sur la documentation interne du
projet, en local, via un modèle Ollama. Aucune donnée ne sort de la plateforme.

## Principe (RAG)
1. **Indexation** : la doc (`docs/`, `README.md`) est découpée en morceaux, vectorisée
   par le modèle d'embeddings `nomic-embed-text` (Ollama) et stockée dans **Chroma**
   (base vectorielle locale, reconstruite automatiquement au démarrage du service).
2. **Question** (`POST /ask`) : la question est vectorisée, les passages les plus proches
   sont récupérés dans Chroma, insérés dans un prompt, et le LLM `qwen2.5:3b` (Ollama)
   rédige la réponse **en citant ses sources**.
3. Orchestration via **LangChain** (`langchain-ollama`, `langchain-chroma`).

## Garde-fous (pièges du sujet)
- L'assistant **n'a aucun droit** sur Docker ni sur les services : il monte la doc en
  **lecture seule** et ne fait qu'indexer et répondre. À ne pas confondre avec le
  remediator, qui lui agit.
- Le prompt impose de répondre **uniquement** à partir du contexte et de **dire quand
  l'information est absente** (limite des hallucinations).
- `/reindex` n'est **pas** exposé par le WAF ; seul `/ask` l'est.

## Modèles
- LLM : `qwen2.5:3b` (≤ 8 Md de paramètres). Repli possible `qwen2.5:1.5b` ou `phi3:mini`
  si la RAM est limitée (`OLLAMA_MODEL` dans `.env`).
- Embeddings : `nomic-embed-text`.
- De préférence sur le **PC délestage IA** (`OLLAMA_URL`).

## Utilisation
```bash
./scripts/pull_models.sh      # 1re fois : télécharge les modèles + indexe la doc
./scripts/assistant_ask.sh "Quelle est la procédure de remédiation d'un DoS ?"
```
Depuis le frontend : onglet **Assistant** (via le WAF, `/api/assistant/ask`).

## Limites
- Qualité bornée par un petit modèle local (3 Md) et par la doc disponible.
- Indexation à refaire (`POST /reindex`) après une modification de la doc.
- Démarrage : l'index n'est prêt qu'une fois les modèles Ollama téléchargés.
- `pickle`/téléchargements : les modèles proviennent du registre officiel Ollama.
