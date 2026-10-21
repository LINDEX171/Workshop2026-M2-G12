import { useEffect, useState } from "react";

import { Phase, PlatformStatus, api } from "../api";
import Hero from "../components/Hero";
import ScoreMeter from "../components/ScoreMeter";
import StatusPill from "../components/StatusPill";
import { formatTime } from "../format";

const POLL_MS = 3000;

const SERVICE_LABELS: Record<string, string> = {
  "payment-api": "Paiements",
  auth: "Authentification",
  db: "Base paiements",
  "auth-db": "Base utilisateurs",
  detector: "Détection ML",
  remediator: "Remédiation",
  assistant: "Assistant RAG",
};

const PHASES: { id: Phase; label: string; caption: string }[] = [
  { id: "before", label: "Avant", caption: "Service nominal" },
  { id: "during", label: "Pendant", caption: "Incident en cours" },
  { id: "after", label: "Après", caption: "Service rétabli" },
];

const PHASE_VIEW = {
  before: { title: "Service nominal", text: "Tous les signaux sont dans leur plage habituelle.", tone: "green", icon: "✓", ring: "bg-emerald-400" },
  during: { title: "Incident en cours", text: "Anomalie détectée : la remédiation automatique est engagée.", tone: "red", icon: "!", ring: "bg-red-400" },
  after: { title: "Service rétabli", text: "Reprise vérifiée par une transaction réelle à travers le WAF.", tone: "sky", icon: "✓", ring: "bg-sky-400" },
} as const;

const EVENT_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  detected: { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500", label: "Détecté" },
  running: { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500", label: "En cours" },
  recovered: { badge: "bg-green-50 text-good", dot: "bg-good", label: "Rétabli" },
  failed: { badge: "bg-red-50 text-critical", dot: "bg-critical", label: "Échec" },
  escalated: { badge: "bg-red-50 text-critical", dot: "bg-critical", label: "Escaladé" },
};
const DEFAULT_EVENT = { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", label: "" };

export default function Supervision({ token }: { token: string }) {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await api.status(token);
        if (!cancelled) {
          setStatus(s);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  const view = PHASE_VIEW[status?.phase ?? "before"];
  const phaseIndex = PHASES.findIndex((p) => p.id === status?.phase);
  const services = status ? Object.entries(status.services) : [];
  const servicesOk = services.filter(([, s]) => s === "ok").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">
          ✕ Supervision injoignable : {error}
          {status && " (dernières données affichées)"}
        </div>
      )}

      {/* --- État global + frise Avant / Pendant / Après --- */}
      <Hero
        tone={status ? view.tone : "indigo"}
        eyebrow="État de la plateforme"
        title={
          <span className="flex items-center gap-4">
            <span className="relative flex h-12 w-12 shrink-0">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${view.ring}`} />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-[#0B1620] ${view.ring}`}>
                {view.icon}
              </span>
            </span>
            {status ? view.title : "Connexion à la supervision…"}
          </span>
        }
        description={status ? view.text : undefined}
        aside={
          status && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              En direct · {formatTime(status.generated_at)}
            </span>
          )
        }
      >
        <ol className="mt-8 grid grid-cols-3 gap-3">
          {PHASES.map((p, i) => {
            const active = p.id === status?.phase;
            const done = phaseIndex > i;
            return (
              <li
                key={p.id}
                className={`relative rounded-2xl px-4 py-3 ring-1 transition ${
                  active
                    ? p.id === "during"
                      ? "bg-red-500/20 ring-red-400/50"
                      : "bg-emerald-500/15 ring-emerald-400/40"
                    : "bg-white/5 ring-white/10"
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-[0.2em] ${active ? "text-white" : done ? "text-slate-300" : "text-slate-500"}`}>
                  {i + 1}. {p.label}
                </p>
                <p className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>{p.caption}</p>
              </li>
            );
          })}
        </ol>
      </Hero>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Services --- */}
        <section className="card card-pad lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="card-title">Services</h2>
            {status && (
              <span className={`badge ${servicesOk === services.length ? "bg-green-50 text-good" : "bg-red-50 text-critical"}`}>
                {servicesOk} / {services.length} opérationnels
              </span>
            )}
          </div>
          {status ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map(([name, state]) => (
                <StatusPill key={name} id={name} name={SERVICE_LABELS[name] ?? name} state={state} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}
        </section>

        {/* --- Score ML --- */}
        <section className="card card-pad flex flex-col">
          <h2 className="card-title">Score d'anomalie</h2>
          <div className="flex flex-1 flex-col justify-center py-4">
            {status ? (
              <ScoreMeter score={status.score.score} threshold={status.score.threshold} modelLoaded={status.score.model_loaded} />
            ) : (
              <div className="mx-auto h-32 w-56 animate-pulse rounded-t-full bg-slate-100" />
            )}
          </div>
          <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
            Isolation Forest et enveloppe statistique, appris sur le trafic normal (métriques Prometheus).
          </p>
        </section>
      </div>

      {/* --- Journal des remédiations, en frise --- */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="card-title">Journal des remédiations</h2>
          {status && <span className="badge bg-slate-100 text-slate-500">{status.events.length}</span>}
        </div>
        {!status || status.events.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" />
              </svg>
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-700">Aucune remédiation enregistrée</p>
            <p className="mt-1 text-xs text-slate-400">Les actions automatiques apparaîtront ici dès le premier incident.</p>
          </div>
        ) : (
          <ol className="px-6 py-5">
            {status.events.map((e, i) => {
              const st = EVENT_STYLES[e.status] ?? DEFAULT_EVENT;
              const last = i === status.events.length - 1;
              return (
                <li key={`${e.ts}-${i}`} className="relative flex gap-4 pb-5 last:pb-0">
                  {!last && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" aria-hidden="true" />}
                  <span className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-white ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs tabular-nums text-slate-400">{formatTime(e.ts)}</span>
                      <span className="text-sm font-semibold text-slate-800">{e.action ?? e.type ?? "Action inconnue"}</span>
                      <span className={`badge ${st.badge}`}>{st.label || e.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.type ?? "Incident inconnu"}
                      {e.target && <> · cible <span className="font-mono">{e.target}</span></>}
                      {e.detail && <> · {e.detail}</>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {status && (
        <p className="text-right text-xs text-slate-400">Rafraîchi toutes les {POLL_MS / 1000} s</p>
      )}
    </div>
  );
}
