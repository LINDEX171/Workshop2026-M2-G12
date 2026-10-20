import raw from "./resilience-alpha-logo.svg?raw";

// Le bleu nuit du logo suit `currentColor` (lisible sur fond clair comme sombre),
// le vert de la marque reste fixe. Dimensions natives retirées : la taille vient du parent.
const svg = raw
  .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"')
  .replaceAll("#0B1620", "currentColor");

// Logo complet : bouclier + « RESILIENCE ALPHA »
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Resilience Alpha"
      className={`inline-block ${className}`}
      style={{ aspectRatio: "229.18 / 71" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Bouclier seul, pour les espaces réduits (en-tête mobile)
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="2 0 60 72" className={className} role="img" aria-label="Resilience Alpha">
      <path
        d="M32 3 L59 13 V35 C59 52 47 63 32 69 C17 63 5 52 5 35 V13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinejoin="round"
      />
      <path
        d="M44 25 C40 40 35 48 27.5 48 C21.5 48 18.5 43.5 18.5 38 C18.5 31 23 25.5 29 25.5 C35.5 25.5 38 33 40.5 40.5 C42.5 46 44.5 48 47.5 48"
        fill="none"
        stroke="#0E8A66"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
