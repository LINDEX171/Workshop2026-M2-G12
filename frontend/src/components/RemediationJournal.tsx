import { ReactNode, useState } from "react";

import { RemediationEvent } from "../api";
import { formatTime } from "../format";

// Libellés lisibles des types d'incident et des actions du remediator
const TYPES: Record<string, string> = {
  availability_dos: "Déni de service applicatif",
  service_down: "Service indisponible",
  data_incoherent: "Données incohérentes",
};
const ACTIONS: Record<string, string> = {
  ban_attaquant: "Bannissement de l'attaquant au WAF",
  "restart_payment-api": "Redémarrage de payment-api",
  restart_service: "Redémarrage du service",
  rollback_image: "Retour à l'image saine",
  restore_db: "Restauration de la base",
};

const STEP = {
  detected: { label: "Anomalie détectée", dot: "bg-amber-500", text: "text-amber-700" },
  running: { label: "Action en cours", dot: "bg-indigo-500", text: "text-indigo-700" },
  recovered: { label: "Reprise vérifiée", dot: "bg-good", text: "text-good" },
  failed: { label: "Action échouée", dot: "bg-critical", text: "text-critical" },
  escalated: { label: "Escaladé à l'opérateur", dot: "bg-critical", text: "text-critical" },
} as const;
type StepStatus = keyof typeof STEP;

const OUTCOME = {
  recovered: { label: "Rétabli", badge: "bg-green-50 text-good ring-green-200", icon: "✓", tile: "bg-green-50 text-good" },
  escalated: { label: "Escaladé", badge: "bg-red-50 text-critical ring-red-200", icon: "!", tile: "bg-red-50 text-critical" },
  running: { label: "En cours", badge: "bg-amber-50 text-amber-700 ring-amber-200", icon: "…", tile: "bg-amber-50 text-amber-700" },
};

interface Incident {
  start: RemediationEvent;
  steps: RemediationEvent[];
  outcome: keyof typeof OUTCOME;
  durationMs: number;
}

const ms = (iso: string) => new Date(iso).getTime();
const seconds = (value: number) => `${(value / 1000).toFixed(1).replace(".", ",")} s`;

// Le journal arrive du plus récent au plus ancien : on le remet dans l'ordre et chaque
// « detected » ouvre un nouvel incident qui regroupe les étapes suivantes.
function groupIncidents(events: RemediationEvent[]): Incident[] {
  const incidents: Incident[] = [];
  for (const e of [...events].reverse()) {
    if (e.status === "detected" || incidents.length === 0) {
      incidents.push({ start: e, steps: [e], outcome: "running", durationMs: 0 });
    } else {
      incidents[incidents.length - 1].steps.push(e);
    }
  }
  for (const inc of incidents) {
    const last = inc.steps[inc.steps.length - 1];
    inc.outcome = last.status === "recovered" ? "recovered" : last.status === "escalated" ? "escalated" : "running";
    inc.durationMs = ms(last.ts) - ms(inc.start.ts);
  }
  return incidents.reverse();
}

function scoreOf(e: RemediationEvent) {
  const m = e.detail?.match(/score=([\d.]+)/);
  return m ? Number(m[1]).toFixed(2) : null;
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const PAGE = 5;

export default function RemediationJournal({ events }: { events: RemediationEvent[] | null }) {
  const [shown, setShown] = useState(PAGE);
  const incidents = events ? groupIncidents(events) : [];
  const closed = incidents.filter((i) => i.outcome !== "running");
  const recovered = incidents.filter((i) => i.outcome === "recovered");
  const avgMs = recovered.length ? recovered.reduce((s, i) => s + i.durationMs, 0) / recovered.length : null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Journal des remédiations</h2>
          <p className="text-xs text-slate-500">Chaque incident, de la détection à la preuve de reprise, sans intervention humaine.</p>
        </div>
        {incidents.length > 0 && <span className="badge bg-slate-100 text-slate-600">{incidents.length} incident{incidents.length > 1 ? "s" : ""}</span>}
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-700">Aucun incident enregistré</p>
          <p className="mt-1 text-xs text-slate-400">Les remédiations automatiques apparaîtront ici dès la première anomalie.</p>
        </div>
      ) : (
        <div className="space-y-5 p-6">
          {/* --- Indicateurs --- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Incidents" value={incidents.length} hint={`${closed.length} clos`} />
            <Stat
              label="Reprise automatique"
              value={closed.length ? `${Math.round((recovered.length / closed.length) * 100)} %` : "En attente"}
              hint={`${recovered.length} sur ${closed.length} sans humain`}
            />
            <Stat label="Temps moyen de remédiation" value={avgMs === null ? "En attente" : seconds(avgMs)} hint="de la détection à la preuve" />
            <Stat label="Dernier incident" value={formatTime(incidents[0].start.ts)} hint={TYPES[incidents[0].start.type ?? ""] ?? incidents[0].start.type} />
          </div>

          {/* --- Incidents --- */}
          <ol className="space-y-3">
            {incidents.slice(0, shown).map((inc) => {
              const o = OUTCOME[inc.outcome];
              const score = scoreOf(inc.start);
              return (
                <li key={inc.start.ts} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
                  {/* En-tête de l'incident */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${o.tile} ${inc.outcome === "running" ? "animate-pulse" : ""}`}>
                      {o.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{TYPES[inc.start.type ?? ""] ?? inc.start.type ?? "Incident"}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="tabular-nums">{formatTime(inc.start.ts)}</span>
                        {inc.start.target && (
                          <>
                            · cible <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{inc.start.target}</span>
                          </>
                        )}
                        {score && (
                          <>
                            · score <span className="font-semibold tabular-nums text-slate-700">{score}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${o.badge}`}>{o.label}</span>
                      {inc.outcome !== "running" && (
                        <p className="mt-1 text-xs text-slate-500">
                          en <span className="font-semibold tabular-nums text-slate-800">{seconds(inc.durationMs)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Frise des étapes */}
                  <ol className="mt-4 grid gap-3 sm:grid-flow-col sm:auto-cols-fr">
                    {inc.steps.map((s, k) => {
                      const st = STEP[(s.status in STEP ? s.status : "running") as StepStatus];
                      const delta = k === 0 ? null : ms(s.ts) - ms(inc.start.ts);
                      const title = s.status === "running" ? ACTIONS[s.action ?? ""] ?? s.action ?? st.label : st.label;
                      const detail = s.status === "detected" && score ? `score ${score}` : s.detail;
                      return (
                        <li key={`${s.ts}-${k}`} className="relative rounded-xl bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                              <span className={`text-[11px] font-semibold uppercase tracking-wide ${st.text}`}>{k + 1}. {st.label}</span>
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-slate-400">{delta === null ? formatTime(s.ts) : `+${seconds(delta)}`}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-800">{title}</p>
                          {detail && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500" title={detail}>{detail}</p>}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>

          {incidents.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand/50 hover:text-brand"
            >
              Afficher {Math.min(PAGE, incidents.length - shown)} incident{incidents.length - shown > 1 ? "s" : ""} de plus
            </button>
          )}
        </div>
      )}
    </section>
  );
}
