import { ServiceState } from "../api";

// Couleur + icône + libellé : l'état n'est jamais porté par la couleur seule
const STYLES: Record<ServiceState, { dot: string; icon: string; label: string }> = {
  ok: { dot: "bg-good", icon: "✓", label: "OK" },
  ko: { dot: "bg-critical", icon: "✕", label: "KO" },
  unknown: { dot: "bg-slate-400", icon: "?", label: "Inconnu" },
};

export default function StatusPill({ name, state }: { name: string; state: ServiceState }) {
  const s = STYLES[state] ?? STYLES.unknown;
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="font-medium">{name}</span>
      <span className="flex items-center gap-2 text-sm text-slate-700">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${s.dot}`}
          aria-hidden="true"
        >
          {s.icon}
        </span>
        {s.label}
      </span>
    </div>
  );
}
