import { ReactNode } from "react";

import { ServiceState } from "../api";

// Couleur + icône + libellé : l'état n'est jamais porté par la couleur seule
const STYLES: Record<ServiceState, { dot: string; label: string; text: string; card: string }> = {
  ok: { dot: "bg-good", label: "Opérationnel", text: "text-good", card: "border-slate-200" },
  ko: { dot: "bg-critical", label: "Hors service", text: "text-critical", card: "border-red-200 bg-red-50/40" },
  unknown: { dot: "bg-slate-400", label: "Inconnu", text: "text-slate-500", card: "border-slate-200" },
};

const ICONS: Record<string, ReactNode> = {
  "payment-api": <path d="M3 10h18M6 15h4M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  auth: <path d="M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7zM16.5 9.5h.01" />,
  db: <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
  "auth-db": <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
  detector: <path d="M3 12h4l2 6 4-14 2 8h6" />,
  remediator: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" />,
  assistant: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />,
};
const DEFAULT_ICON = <path d="M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01" />;

export default function StatusPill({ id, name, state }: { id: string; name: string; state: ServiceState }) {
  const s = STYLES[state] ?? STYLES.unknown;
  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition hover:shadow-sm ${s.card}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          {ICONS[id] ?? DEFAULT_ICON}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
        <p className="truncate font-mono text-xs text-slate-400">{id}</p>
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
        <span className="relative flex h-2.5 w-2.5">
          {state === "ok" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${s.dot}`} />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
        </span>
        {s.label}
      </span>
    </div>
  );
}
