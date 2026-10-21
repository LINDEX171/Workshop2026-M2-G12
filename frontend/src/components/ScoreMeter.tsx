interface Props {
  score: number | null;
  threshold: number;
  modelLoaded: boolean;
}

// Point de l'arc (demi-cercle de centre 100,100) pour une valeur entre 0 et 1
function point(value: number, radius: number) {
  const angle = Math.PI * (1 - value);
  return { x: 100 + radius * Math.cos(angle), y: 100 - radius * Math.sin(angle) };
}

// Jauge en demi-cercle du score d'anomalie (0 → 1), avec un repère au seuil d'alerte
export default function ScoreMeter({ score, threshold, modelLoaded }: Props) {
  const above = score !== null && score > threshold;
  const value = score === null ? 0 : Math.min(Math.max(score, 0), 1);
  const t = Math.min(Math.max(threshold, 0), 1);
  const tickIn = point(t, 64);
  const tickOut = point(t, 96);
  const label = point(t, 108);
  const color = score === null ? "#CBD5E1" : above ? "#DC2626" : "#0E8A66";

  return (
    <div>
      <svg
        viewBox="0 0 200 122"
        className="mx-auto w-full max-w-[17rem]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score ?? undefined}
        aria-label="Score d'anomalie"
      >
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value * 100} 100`}
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
        />
        <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="#0B1620" strokeWidth="2.5" strokeLinecap="round" />
        <text x={label.x} y={label.y} textAnchor="middle" fontSize="9" fill="#64748B" fontWeight="600">seuil {threshold.toFixed(2)}</text>
        <text x="100" y="92" textAnchor="middle" fontSize="34" fontWeight="700" fill={above ? "#DC2626" : "#0F172A"} style={{ fontVariantNumeric: "tabular-nums" }}>
          {score === null ? "N/D" : score.toFixed(2)}
        </text>
        <text x="20" y="118" textAnchor="middle" fontSize="9" fill="#94A3B8">0</text>
        <text x="180" y="118" textAnchor="middle" fontSize="9" fill="#94A3B8">1</text>
      </svg>

      <div className="mt-2 flex justify-center">
        <span
          className={`badge ${
            score === null ? "bg-slate-100 text-slate-500" : above ? "bg-red-50 text-critical" : "bg-green-50 text-good"
          }`}
        >
          {score === null ? (modelLoaded ? "En attente" : "Modèle non chargé") : above ? "✕ Anomalie détectée" : "✓ Comportement normal"}
        </span>
      </div>
    </div>
  );
}
