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
        <span className="text-4xl font-bold tabular-nums">{score === null ? "—" : score.toFixed(2)}</span>
        <span className="text-sm text-slate-700">
          {score === null ? (
            modelLoaded ? "En attente de données" : "Modèle non chargé"
          ) : (
            <>
              <span className={`font-semibold ${above ? "text-critical" : "text-good"}`}>{above ? "✕" : "✓"}</span>{" "}
              {above ? "Anomalie détectée" : "Comportement normal"}
            </>
          )}
        </span>
      </div>

      <div
        className="relative mt-4 h-3 rounded bg-slate-200"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score ?? undefined}
        aria-label="Score d'anomalie"
      >
        <div
          className={`h-3 rounded transition-all duration-500 ${above ? "bg-critical" : "bg-good"}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -top-1 h-5 w-0.5 bg-slate-900" style={{ left: `${threshold * 100}%` }} />
      </div>
      <div className="relative mt-1 h-4 text-xs text-slate-500">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${threshold * 100}%` }}>
          seuil {threshold}
        </span>
        <span className="absolute right-0">1</span>
      </div>
    </div>
  );
}
