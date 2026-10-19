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

const PHASES: { id: Phase; label: string; caption: string; active: string; icon: string }[] = [
  { id: "before", label: "AVANT", caption: "Service nominal", active: "border-good bg-good", icon: "✓" },
  { id: "during", label: "PENDANT", caption: "Incident en cours", active: "border-critical bg-critical", icon: "✕" },
  { id: "after", label: "APRÈS", caption: "Service rétabli", active: "border-good bg-good", icon: "✓" },
];

const card = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

export default function Supervision() {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await api.status();
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
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-critical bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-critical">✕</span> Supervision injoignable : {error}
          {status && " — dernières données affichées"}
        </div>
      )}

      {/* Bandeau AVANT / PENDANT / APRÈS, lisible d'un coup d'œil par le jury */}
      <section className="grid gap-3 sm:grid-cols-3">
        {PHASES.map((p) => {
          const isActive = status?.phase === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-xl border-2 px-6 py-5 transition ${
                isActive ? `${p.active} text-white shadow-lg` : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <p className="text-2xl font-black tracking-wide">
                {isActive && <span aria-hidden="true">{p.icon} </span>}
                {p.label}
              </p>
              <p className="text-sm font-medium">{p.caption}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-4 text-lg font-semibold">État des services</h2>
          {status ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(status.services).map(([name, state]) => (
                <StatusPill key={name} name={SERVICE_LABELS[name] ?? name} state={state} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chargement…</p>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 text-lg font-semibold">Score d'anomalie</h2>
          {status ? (
            <ScoreMeter
              score={status.score.score}
              threshold={status.score.threshold}
              modelLoaded={status.score.model_loaded}
            />
          ) : (
            <p className="text-sm text-slate-500">Chargement…</p>
          )}
          <p className="mt-4 text-xs text-slate-500">Isolation Forest sur les métriques Prometheus.</p>
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-4 text-lg font-semibold">Journal des remédiations</h2>
        {!status || status.events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune remédiation enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Heure</th>
                <th className="pb-2 font-medium">Incident</th>
                <th className="pb-2 font-medium">Cible</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {status.events.map((e, i) => (
                <tr key={`${e.ts}-${i}`} className="border-t border-slate-100">
                  <td className="py-2 tabular-nums">{formatTime(e.ts)}</td>
                  <td className="py-2">{e.type ?? "—"}</td>
                  <td className="py-2">{e.target ?? "—"}</td>
                  <td className="py-2">{e.action ?? "—"}</td>
                  <td className="py-2">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {status && (
        <p className="text-right text-xs text-slate-500">
          Mis à jour à {formatTime(status.generated_at)} · rafraîchi toutes les {POLL_MS / 1000} s
        </p>
      )}
    </div>
  );
}
