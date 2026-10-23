import raw from "./auto-heal-logo.svg?raw";

// Le bleu nuit du logo suit `currentColor` (lisible sur fond clair comme sombre),
// le vert de la marque reste fixe. Dimensions natives retirées : la taille vient du parent.
const svg = raw
  .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"')
  .replaceAll("#0B1620", "currentColor");

// Logo complet : bouclier + « Auto Heal » + sous-titre
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Auto Heal"
      className={`inline-block ${className}`}
      style={{ aspectRatio: "223.62 / 71" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Bouclier seul (flèche de reprise + croix de soin), pour les espaces réduits
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="2 0 60 72" className={className} role="img" aria-label="Auto Heal">
      <path
        d="M32 3 L59 13 V35 C59 52 47 63 32 69 C17 63 5 52 5 35 V13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#0E8A66" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40.32 24.62 A14.5 14.5 0 1 1 25.87 23.36" />
        <path d="M21.04 20.09 L28.14 22.30 L25.27 29.16" />
        <path d="M32 30.5 V42.5 M26 36.5 H38" />
      </g>
    </svg>
  );
}
