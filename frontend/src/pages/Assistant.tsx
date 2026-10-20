import { FormEvent, useState } from "react";

import { ApiError, api } from "../api";

const card = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";
const SUGGESTIONS = [
  "Quelle est la procédure de remédiation d'un DoS ?",
  "Comment fonctionne la détection d'anomalies ?",
  "Pourquoi le service auth ne peut-il pas joindre la base de données ?",
];

export default function Assistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const r = await api.ask(question.trim());
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className={card}>
        <h2 className="text-lg font-semibold">Assistant documentaire</h2>
        <p className="mt-1 text-sm text-slate-500">
          Répond à partir de la documentation interne du projet (RAG local, Ollama). En lecture seule :
          aucun accès aux services ni à Docker.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
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
                onClick={() => setQuestion(s)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                {s}
              </button>
            ))}
          </div>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={loading || question.trim().length < 3}
          >
            {loading ? "Recherche…" : "Demander"}
          </button>
        </form>
      </section>

      {error && (
        <div className="rounded-lg border border-critical bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-critical">✕</span> {error}
        </div>
      )}

      {answer && (
        <section className={card}>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">Réponse</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
          {sources.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500">Sources</p>
              <ul className="mt-1 space-y-1">
                {sources.map((s) => (
                  <li key={s} className="text-xs text-slate-600">
                    📄 {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
