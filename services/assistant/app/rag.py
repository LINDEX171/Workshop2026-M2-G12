"""RAG local : indexation de la doc interne dans Chroma, réponse via Ollama (LangChain).

Garde-fou : l'assistant LIT seulement la documentation. Aucun accès Docker, aucun droit
sur les services. Il ne doit pas être confondu avec le remediator.

Les fonctions pures (découpage, prompt, sources) sont séparées des parties LangChain
(importées paresseusement) pour rester testables sans Ollama ni dépendances lourdes.
"""
import shutil
from pathlib import Path

import structlog

from app.config import Settings

log = structlog.get_logger()

SYSTEM_PROMPT = """Tu es l'assistant interne du projet RESILIENCE-ALPHA (plateforme de \
paiement conteneurisée). Réponds en français, de façon concise et factuelle, en \
t'appuyant UNIQUEMENT sur le contexte fourni. Si l'information ne figure pas dans le \
contexte, dis-le clairement sans inventer. Cite les sources utilisées."""


def load_chunks(knowledge_dir: str, chunk_size: int, overlap: int) -> list[dict]:
    """Découpe tous les .md/.txt de la doc en morceaux {text, source} (pur Python)."""
    root = Path(knowledge_dir)
    chunks: list[dict] = []
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() not in (".md", ".txt") or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
        if not text:
            continue
        source = str(path.relative_to(root))
        start = 0
        while start < len(text):
            piece = text[start:start + chunk_size]
            chunks.append({"text": piece, "source": source})
            if start + chunk_size >= len(text):
                break
            start += chunk_size - overlap
    return chunks


def build_prompt(question: str, contexts: list[dict]) -> str:
    """Prompt RAG : consignes + passages numérotés avec leur source + question."""
    blocks = [f"[Source: {c['source']}]\n{c['text']}" for c in contexts]
    context = "\n\n---\n\n".join(blocks) if blocks else "(aucun passage pertinent trouvé)"
    return f"{SYSTEM_PROMPT}\n\n=== CONTEXTE ===\n{context}\n\n=== QUESTION ===\n{question}\n\n=== RÉPONSE ==="


def format_sources(contexts: list[dict]) -> list[str]:
    """Liste ordonnée et dédupliquée des sources citées."""
    seen: list[str] = []
    for c in contexts:
        if c["source"] not in seen:
            seen.append(c["source"])
    return seen


class Assistant:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._vs = None
        self.indexed = 0

    def _embeddings(self):
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(model=self.settings.embed_model, base_url=self.settings.ollama_url)

    def _vectorstore(self):
        from langchain_chroma import Chroma
        if self._vs is None:
            self._vs = Chroma(
                collection_name="knowledge",
                embedding_function=self._embeddings(),
                persist_directory=self.settings.chroma_dir,
            )
        return self._vs

    def index(self) -> int:
        """(Ré)indexe toute la doc dans Chroma. Nécessite Ollama (embeddings) joignable."""
        chunks = load_chunks(self.settings.knowledge_dir, self.settings.chunk_size, self.settings.chunk_overlap)
        if not chunks:
            log.warning("no_knowledge_found", dir=self.settings.knowledge_dir)
            self.indexed = 0
            return 0
        # Repartir d'un index propre (évite les doublons à chaque réindexation)
        self._vs = None
        shutil.rmtree(self.settings.chroma_dir, ignore_errors=True)
        Path(self.settings.chroma_dir).mkdir(parents=True, exist_ok=True)
        vs = self._vectorstore()
        vs.add_texts(
            texts=[c["text"] for c in chunks],
            metadatas=[{"source": c["source"]} for c in chunks],
        )
        self.indexed = len(chunks)
        log.info("knowledge_indexed", chunks=self.indexed)
        return self.indexed

    def ask(self, question: str) -> dict:
        from langchain_ollama import ChatOllama

        docs = self._vectorstore().similarity_search(question, k=self.settings.top_k)
        contexts = [{"text": d.page_content, "source": d.metadata.get("source", "?")} for d in docs]
        llm = ChatOllama(model=self.settings.ollama_model, base_url=self.settings.ollama_url, temperature=0)
        answer = llm.invoke(build_prompt(question, contexts)).content
        return {"answer": answer, "sources": format_sources(contexts)}
