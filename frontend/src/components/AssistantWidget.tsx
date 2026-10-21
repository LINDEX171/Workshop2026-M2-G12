import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api";

const SUGGESTIONS: { q: string; icon: ReactNode }[] = [
  { q: "Quelle est la procédure de remédiation d'un DoS ?", icon: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" /> },
  { q: "Comment fonctionne la détection d'anomalies ?", icon: <path d="M3 12h4l2 6 4-14 2 8h6" /> },
  { q: "Pourquoi le service auth ne peut-il pas joindre la base de données ?", icon: <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /> },
];

const HISTORY_TURNS = 6; // messages précédents transmis à l'assistant

const BOT_ICON = <path d="M12 3v3M7 9h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3zM9.5 14h.01M14.5 14h.01" />;

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
  sources?: string[];
}

function Svg({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function BotAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
      <Svg className="h-4 w-4">{BOT_ICON}</Svg>
    </span>
  );
}

// Assistant documentaire flottant : bulle en bas à droite, panneau de chat disponible sur toutes les pages.
// Monté une seule fois dans App : la conversation survit à la fermeture du panneau et aux changements d'onglet.
export default function AssistantWidget({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const openRef = useRef(open); // lu à l'arrivée d'une réponse (la closure de ask serait périmée)
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    setUnread(false);
    input.current?.focus();
    const onEsc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || loading) return;
    // Derniers échanges envoyés comme contexte (les erreurs n'en font pas partie)
    const history = messages
      .filter((m): m is Message & { role: "user" | "assistant" } => m.role !== "error")
      .slice(-HISTORY_TURNS)
      .map(({ role, text }) => ({ role, text: text.slice(0, 2000) }));
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const r = await api.ask(token, text, history);
      setMessages((m) => [...m, { role: "assistant", text: r.answer, sources: r.sources }]);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 503
          ? "L'assistant n'est pas encore prêt (modèles Ollama en cours de chargement)."
          : (err as Error).message;
      setMessages((m) => [...m, { role: "error", text: msg }]);
    } finally {
      setLoading(false);
      if (!openRef.current) setUnread(true);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  // Entrée envoie, Maj + Entrée passe à la ligne
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(question);
    }
  }

  return (
    <>
      {/* --- Panneau de chat (plein écran sur mobile) --- */}
      {open && (
        <section
          id="assistant-panel"
          role="dialog"
          aria-label="Assistant documentaire"
          className="assistant-panel fixed inset-0 z-50 flex flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(560px,calc(100vh-8rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl"
        >
          <header className="flex items-center gap-3 bg-[#0B1620] px-4 py-3 text-white">
            <BotAvatar />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Assistant documentaire</p>
              <p className="text-[11px] text-slate-400">100 % local · lecture seule · sources citées</p>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={loading || messages.length === 0}
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <Svg className="h-4 w-4"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Fermer (Échap)"
              aria-label="Fermer l'assistant"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Svg className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></Svg>
            </button>
          </header>

          {/* --- Conversation --- */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">
            {messages.length === 0 && !loading && (
              <div>
                <p className="text-sm text-slate-600">
                  Bonjour ! Je réponds à partir de la documentation de l'équipe : architecture, détection, remédiation, procédures.
                </p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Suggestions</p>
                <div className="mt-2 space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.q}
                      type="button"
                      onClick={() => ask(s.q)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand/40 hover:shadow-sm"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <Svg className="h-4 w-4">{s.icon}</Svg>
                      </span>
                      <span className="text-sm leading-snug text-slate-700 group-hover:text-slate-900">{s.q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#0B1620] px-3.5 py-2.5 text-sm text-white shadow-sm">{m.text}</p>
                </div>
              ) : m.role === "error" ? (
                <div key={i} className="flex gap-2.5">
                  <BotAvatar />
                  <p className="rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-critical">✕ {m.text}</p>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <BotAvatar />
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{m.text}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                        {m.sources.map((s) => (
                          <span key={s} className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                            <Svg className="h-3 w-3 shrink-0"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" /></Svg>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex gap-2.5">
                <BotAvatar />
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm" aria-label="L'assistant rédige la réponse">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>

          {/* --- Zone de saisie --- */}
          <form onSubmit={submit} className="border-t border-slate-100 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <textarea
                ref={input}
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                rows={1}
                placeholder="Posez votre question…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                disabled={loading || question.trim().length < 3}
                aria-label="Envoyer la question"
              >
                <Svg className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-slate-400">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>
          </form>
        </section>
      )}

      {/* --- Bulle : petit rebond à l'arrivée, halo quand une réponse attend d'être lue --- */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? "Fermer l'assistant" : unread ? "Ouvrir l'assistant (nouvelle réponse)" : "Ouvrir l'assistant"}
        title="Assistant documentaire"
        className={`assistant-launcher fixed bottom-6 right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${open ? "hidden sm:flex" : "flex"}`}
      >
        {unread && <span className="assistant-halo absolute inset-0 rounded-full bg-brand" />}
        <Svg className="relative h-6 w-6">{open ? <path d="M6 9l6 6 6-6" /> : BOT_ICON}</Svg>
        {unread && <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-critical" />}
      </button>
    </>
  );
}
