import { ReactNode, useCallback, useEffect, useState } from "react";

import { PlatformStatus, Transaction, api } from "../api";
import CardStack from "../components/CardStack";
import { formatEuros, formatTime } from "../format";

interface Shortcut<T extends string> {
  id: T;
  label: string;
  subtitle: string;
  icon: ReactNode;
}

interface Props<T extends string> {
  token: string;
  user: string | null;
  shortcuts: Shortcut<T>[];
  onOpen: (id: T) => void;
}

const POLL_MS = 10000;

// Grille discrète du bandeau (même motif que la page de connexion)
const GRID = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

// Teinte unique des icônes décoratives (couleur de marque) ; les couleurs d'état restent réservées aux statuts
const ICON_TINT = "bg-brand/10 text-brand";

const PHASES = {
  before: { label: "Service nominal", dot: "bg-emerald-400", ring: "bg-emerald-400/20 text-emerald-200" },
  during: { label: "Incident en cours", dot: "bg-red-400", ring: "bg-red-500/20 text-red-200" },
  after: { label: "Service rétabli", dot: "bg-sky-400", ring: "bg-sky-400/20 text-sky-200" },
} as const;

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

function Svg({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function Kpi({ icon, tint, label, value, hint, children }: {
  icon: ReactNode; tint: string; label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

// Page d'accueil : bandeau d'état en direct, indicateurs clés et accès rapide aux autres onglets
export default function Home<T extends string>({ token, user, shortcuts, onOpen }: Props<T>) {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Chaque source est indépendante : une panne de l'une n'efface pas l'autre
  const load = useCallback(async () => {
    setNow(new Date());
    const [s, t] = await Promise.allSettled([api.status(token), api.transactions(token)]);
    setStatus(s.status === "fulfilled" ? s.value : null);
    setTransactions(t.status === "fulfilled" ? t.value : null);
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const phase = status ? PHASES[status.phase] : null;
  const services = status ? Object.values(status.services) : [];
  const servicesOk = services.filter((s) => s === "ok").length;
  const score = status?.score.score ?? null;
  const threshold = status?.score.threshold ?? 0;
  const lastEvent = status?.events[0];
  const accepted = transactions?.filter((t) => t.status === "accepted") ?? [];
  const volume = accepted.reduce((s, t) => s + Number(t.amount), 0);
  const findShortcut = (id: string) => shortcuts.find((s) => s.id === id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* --- Bandeau principal --- */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0B1620] text-white shadow-xl" style={GRID}>
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#0E8A66]/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative grid items-center gap-6 p-8 md:p-10 lg:grid-cols-[1fr_24rem]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6EE7B7]">
              {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {greeting(now)}{user ? `, ${user}` : ""}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
              Votre plateforme de paiement résiliente : chaque anomalie est détectée par Machine Learning
              et corrigée automatiquement, sans intervention humaine.
            </p>

            <div className={`mt-6 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium ${phase ? phase.ring : "bg-white/10 text-slate-300"}`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${phase ? phase.dot : "bg-slate-400"}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${phase ? phase.dot : "bg-slate-400"}`} />
              </span>
              {phase ? phase.label : "État indisponible"}
              {status && <span className="text-xs opacity-70">· {formatTime(status.generated_at)}</span>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {findShortcut("payment") && (
                <button
                  onClick={() => onOpen(findShortcut("payment")!.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0E8A66] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-[#0B7557]"
                >
                  Faire un virement
                  <Svg className="h-4 w-4"><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
                </button>
              )}
              {findShortcut("supervision") && (
                <button
                  onClick={() => onOpen(findShortcut("supervision")!.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
                >
                  Voir la supervision
                </button>
              )}
            </div>
          </div>

          <CardStack className="mx-auto hidden h-[17rem] w-full max-w-[24rem] lg:block" />
        </div>
      </section>

      {/* --- Indicateurs en direct --- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Services en ligne"
          tint={ICON_TINT}
          icon={<Svg><path d="M4 7h16M4 12h16M4 17h16M7 7v.01M7 12v.01M7 17v.01" /></Svg>}
          value={status ? `${servicesOk} / ${services.length}` : "Indisponible"}
          hint={status ? (servicesOk === services.length ? "Tous les services répondent" : "Au moins un service hors ligne") : "Supervision injoignable"}
        />
        <Kpi
          label="Score d'anomalie"
          tint={ICON_TINT}
          icon={<Svg><path d="M3 12h4l2 6 4-14 2 8h6" /></Svg>}
          value={score === null ? "En attente" : score.toFixed(2)}
          hint={score === null ? "Modèle en attente" : `Seuil d'alerte : ${threshold.toFixed(2)}`}
        >
          {score !== null && (
            <div className="relative mt-3 h-1.5 rounded-full bg-slate-100">
              <div
                className={`h-1.5 rounded-full ${score > threshold ? "bg-critical" : "bg-good"}`}
                style={{ width: `${Math.min(Math.max(score, 0), 1) * 100}%` }}
              />
              <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-slate-500" style={{ left: `${Math.min(threshold, 1) * 100}%` }} />
            </div>
          )}
        </Kpi>
        <Kpi
          label="Transactions récentes"
          tint={ICON_TINT}
          icon={<Svg><path d="M3 10h18M6 15h4M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></Svg>}
          value={transactions ? `${accepted.length} / ${transactions.length}` : "Indisponible"}
          hint={transactions ? `acceptées · ${formatEuros(volume)} échangés` : "Service de paiement injoignable"}
        />
        <Kpi
          label="Dernière remédiation"
          tint={ICON_TINT}
          icon={<Svg><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" /></Svg>}
          value={lastEvent ? <span className="capitalize">{lastEvent.status}</span> : "Aucune"}
          hint={lastEvent ? `${lastEvent.action ?? lastEvent.type ?? "action inconnue"} · ${formatTime(lastEvent.ts)}` : "Aucun incident depuis le démarrage"}
        />
      </section>

      {/* --- Accès rapide --- */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Accès rapide</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {shortcuts.map((s) => {
            return (
              <button
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="group card card-pad relative overflow-hidden text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    {s.icon}
                  </svg>
                </span>
                <p className="mt-5 text-lg font-semibold text-slate-900">{s.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.subtitle}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  Ouvrir
                  <Svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
