import { useEffect, useState } from "react";

import { Phase, PlatformStatus, api } from "../api";
import ScoreMeter from "../components/ScoreMeter";
import StatusPill from "../components/StatusPill";
import { formatTime } from "../format";

const POLL_MS = 3000;

const SERVICE_LABELS: Record<string, string> = {
  "payment-api": "Paiements (payment-api)",
  auth: "Authentification (auth)",
  db: "Base paiements (db)",
  "auth-db": "Base utilisateurs (auth-db)",
  detector: "Détection ML (detector)",
  remediator: "Remédiation (remediator)",
  assistant: "Assistant RAG (assistant)",
};

const PHASES: { id: Phase; label: string; caption: string }[] = [
  { id: "before", label: "AVANT", caption: "Service nominal" },
  { id: "during", label: "PENDANT", caption: "Incident en cours" },
  { id: "after", label: "APRÈS", caption: "Service rétabli" },
];

const EVENT_STYLES: Record<string, string> = {
  recovered: "bg-green-50 text-good",
  detected: "bg-amber-50 text-amber-600",
  running: "bg-amber-50 text-amber-600",
  escalated: "bg-red-50 text-critical",
};

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

  const phase = status?.phase;
  const isIncident = phase === "during";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">
          ✕ Supervision injoignable : {error}
          {status && " — dernières données affichées"}
        </div>
      )}

      {/* Bandeau de phase */}
      <section
        className={`card card-pad border-l-4 ${
          phase === "during"
            ? "border-l-critical"
            : phase === "after"
              ? "border-l-good"
              : "border-l-slate-300"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                isIncident ? "bg-red-50 text-critical" : "bg-green-50 text-good"
              }`}
            >
              {isIncident ? "✕" : "✓"}
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">État de la plateforme</p>
              <p className="text-xl font-bold text-slate-900">
                {isIncident ? "Incident en cours" : phase === "after" ? "Service rétabli" : "Service nominal"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {PHASES.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg px-4 py-2 text-center ${
                  phase === p.id
                    ? p.id === "during"
                      ? "bg-critical text-white"
                      : "bg-good text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <p className="text-sm font-black tracking-wide">{p.label}</p>
                <p className="text-[10px]">{p.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h2 className="card-title mb-4">État des services</h2>
          {status ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(status.services).map(([name, state]) => (
                <StatusPill key={name} name={SERVICE_LABELS[name] ?? name} state={state} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Chargement…</p>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-2">Score d'anomalie</h2>
          {status ? (
            <ScoreMeter
              score={status.score.score}
              threshold={status.score.threshold}
              modelLoaded={status.score.model_loaded}
            />
          ) : (
            <p className="text-sm text-slate-400">Chargement…</p>
          )}
          <p className="mt-5 text-xs text-slate-400">Isolation Forest sur les métriques Prometheus.</p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title border-b border-slate-100 px-6 py-4">Journal des remédiations</h2>
        {!status || status.events.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">Aucune remédiation enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-2 font-medium">Heure</th>
                  <th className="py-2 font-medium">Incident</th>
                  <th className="py-2 font-medium">Cible</th>
                  <th className="py-2 font-medium">Action</th>
                  <th className="px-6 py-2 text-right font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {status.events.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className="border-t border-slate-50">
                    <td className="px-6 py-2.5 tabular-nums text-slate-500">{formatTime(e.ts)}</td>
                    <td className="py-2.5 text-slate-700">{e.type ?? "—"}</td>
                    <td className="py-2.5 text-slate-500">{e.target ?? "—"}</td>
                    <td className="py-2.5 text-slate-500">{e.action ?? "—"}</td>
                    <td className="px-6 py-2.5 text-right">
                      <span className={`badge ${EVENT_STYLES[e.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {status && (
        <p className="text-right text-xs text-slate-400">
          Mis à jour à {formatTime(status.generated_at)} · rafraîchi toutes les {POLL_MS / 1000} s
        </p>
      )}
    </div>
  );
}
