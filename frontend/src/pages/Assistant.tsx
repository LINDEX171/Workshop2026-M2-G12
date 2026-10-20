import { FormEvent, useState } from "react";

import { ApiError, api } from "../api";

const SUGGESTIONS = [
  "Quelle est la procédure de remédiation d'un DoS ?",
  "Comment fonctionne la détection d'anomalies ?",
  "Pourquoi le service auth ne peut-il pas joindre la base de données ?",
];

export default function Assistant({ token }: { token: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (q.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const r = await api.ask(token, q.trim());
      setAnswer(r.answer);
      setSources(r.sources);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? "L'assistant n'est pas encore prêt (modèles Ollama en cours de chargement)."
          : (err as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card card-pad">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Assistant documentaire</h2>
            <p className="text-sm text-slate-500">RAG local (Ollama) sur la doc interne — lecture seule, sans accès aux services.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Posez une question sur l'architecture, la détection, la remédiation…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  ask(s);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-brand/40 hover:text-brand"
              >
                {s}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" disabled={loading || question.trim().length < 3}>
            {loading ? "Recherche…" : "Demander"}
          </button>
        </form>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">✕ {error}</div>
      )}

      {loading && (
        <div className="card card-pad animate-pulse text-sm text-slate-400">L'assistant rédige la réponse…</div>
      )}

      {answer && !loading && (
        <section className="card card-pad">
          <h3 className="card-title mb-3">Réponse</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{answer}</p>
          {sources.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</p>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <span key={s} className="badge bg-brand/10 text-brand">📄 {s}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
