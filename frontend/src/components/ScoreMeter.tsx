interface Props {
  score: number | null;
  threshold: number;
  modelLoaded: boolean;
}

// Jauge 0 → 1 du score d'anomalie, avec un repère au seuil d'alerte
export default function ScoreMeter({ score, threshold, modelLoaded }: Props) {
  const above = score !== null && score > threshold;
  const pct = score === null ? 0 : Math.min(Math.max(score, 0), 1) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`text-5xl font-bold tabular-nums ${above ? "text-critical" : "text-slate-900"}`}>
          {score === null ? "—" : score.toFixed(2)}
        </span>
        <span
          className={`badge ${
            score === null
              ? "bg-slate-100 text-slate-500"
              : above
                ? "bg-red-50 text-critical"
                : "bg-green-50 text-good"
          }`}
        >
          {score === null
            ? modelLoaded
              ? "En attente"
              : "Modèle non chargé"
            : above
              ? "✕ Anomalie"
              : "✓ Normal"}
        </span>
      </div>

      <div
        className="relative mt-5 h-2.5 rounded-full bg-slate-200"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score ?? undefined}
        aria-label="Score d'anomalie"
      >
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${above ? "bg-critical" : "bg-good"}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute -top-1 h-4.5 w-0.5 bg-slate-900"
          style={{ left: `${threshold * 100}%`, height: "1.1rem" }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-xs text-slate-400">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2 font-medium text-slate-500" style={{ left: `${threshold * 100}%` }}>
          seuil {threshold}
        </span>
        <span className="absolute right-0">1</span>
      </div>
    </div>
  );
}
