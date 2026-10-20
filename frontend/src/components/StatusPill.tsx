import { ServiceState } from "../api";

// Couleur + icône + libellé : l'état n'est jamais porté par la couleur seule
const STYLES: Record<ServiceState, { dot: string; ring: string; label: string; text: string }> = {
  ok: { dot: "bg-good", ring: "bg-green-50", label: "Opérationnel", text: "text-good" },
  ko: { dot: "bg-critical", ring: "bg-red-50", label: "Hors service", text: "text-critical" },
  unknown: { dot: "bg-slate-400", ring: "bg-slate-100", label: "Inconnu", text: "text-slate-500" },
};

export default function StatusPill({ name, state }: { name: string; state: ServiceState }) {
  const s = STYLES[state] ?? STYLES.unknown;
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${s.ring}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
        </span>
        {name}
      </span>
      <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
    </div>
  );
}
