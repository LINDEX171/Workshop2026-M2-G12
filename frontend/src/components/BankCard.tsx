import { ReactNode, useId } from "react";

import { Account } from "../api";
import { formatEuros } from "../format";
import { LogoMark } from "./Logo";

// Fines stries horizontales : effet métal brossé
const BRUSHED = (light: number, dark: number) =>
  `repeating-linear-gradient(0deg, rgba(255,255,255,${light}) 0px, rgba(255,255,255,${light}) 1px, rgba(0,0,0,${dark}) 1px, rgba(0,0,0,${dark}) 2px)`;

// Black, Gold, Metal. `ink` = couleur du texte, dont tout le contenu hérite (currentColor) ;
// `accent` = couleur de la marque et de la gamme ; `texture` = matière posée sur le fond.
const THEMES = [
  {
    name: "Black",
    // Noir laqué, texture fibre de carbone, accents or
    bg: "linear-gradient(135deg, #000000 0%, #0A0A0B 45%, #1A1A1C 70%, #050505 100%)",
    texture:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 2px, transparent 2px, transparent 6px)",
    glow: "rgba(212, 175, 95, 0.22)",
    wave: "#D4AF5F",
    ink: "#EDEDED",
    accent: "#D9B45A",
    shine: "rgba(255,255,255,0.10)",
    emboss: "0 1px 0 rgba(255,255,255,0.12), 0 -1px 0 rgba(0,0,0,0.8)",
  },
  {
    name: "Gold",
    // Or massif : bandes de lumière successives comme sur du métal poli
    bg: "linear-gradient(120deg, #5C4310 0%, #A47A1E 14%, #E9C766 30%, #FFF4C8 42%, #E6BC4F 55%, #A07618 70%, #F2D67E 86%, #6B4E12 100%)",
    texture: BRUSHED(0.08, 0.04),
    glow: "rgba(255, 244, 200, 0.6)",
    wave: "#FFF4C8",
    ink: "#2A1C04",
    accent: "#3D2905",
    shine: "rgba(255,255,255,0.35)",
    emboss: "0 1px 0 rgba(255,250,225,0.7), 0 -1px 0 rgba(80,52,6,0.45)",
  },
  {
    name: "Metal",
    // Chrome brossé : reflets francs et stries marquées
    bg: "linear-gradient(120deg, #3F454D 0%, #9AA1AA 14%, #E9ECEF 28%, #FFFFFF 37%, #B4BAC2 50%, #6B727B 64%, #D6DADF 82%, #4B5159 100%)",
    texture: BRUSHED(0.16, 0.06),
    glow: "rgba(255, 255, 255, 0.55)",
    wave: "#FFFFFF",
    ink: "#161A1F",
    accent: "#161A1F",
    shine: "rgba(255,255,255,0.45)",
    emboss: "0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.3)",
  },
];

function Chip() {
  const id = useId();
  return (
    <svg viewBox="0 0 48 36" className="h-10 w-[3.25rem] drop-shadow" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBEFC5" />
          <stop offset="0.45" stopColor="#E0BC6A" />
          <stop offset="1" stopColor="#A9822F" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="47" height="35" rx="6" fill={`url(#${id}-gold)`} stroke="#8F6E2A" strokeWidth="0.7" />
      <g fill="none" stroke="#7A5C22" strokeWidth="0.9" opacity="0.65">
        <path d="M0 12h16M0 24h16M32 12h16M32 24h16M16 0v36M32 0v36" />
        <rect x="16" y="10" width="16" height="16" rx="3" />
      </g>
    </svg>
  );
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 rotate-90 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M8.5 9a4.5 4.5 0 0 1 0 6M12 6.5a8 8 0 0 1 0 11M15.5 4a11.5 11.5 0 0 1 0 16" />
    </svg>
  );
}

// Lignes ondulées en filigrane, comme sur une vraie carte
function Waves({ color }: { color: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 252" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1" opacity="0.16">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M-20 ${150 + i * 14} C 90 ${90 + i * 14}, 210 ${230 + i * 10}, 420 ${120 + i * 14}`} />
        ))}
      </g>
    </svg>
  );
}

function Eye({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      ) : (
        <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.3M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      )}
    </svg>
  );
}

const label = "text-[10px] font-semibold uppercase tracking-[0.22em] opacity-60";

type Theme = (typeof THEMES)[number];

// Fond, matière et reflets communs à toutes les cartes ; le contenu est fourni par l'appelant
function CardShell({ theme, className = "", children }: { theme: Theme; className?: string; children: ReactNode }) {
  return (
    <div
      className={`group relative aspect-[1.586] overflow-hidden rounded-[1.25rem] shadow-xl ring-1 ring-black/10 ${className}`}
      style={{ background: theme.bg, color: theme.ink }}
    >
      {/* Décor : matière, halo, vagues, reflet diagonal fixe, reflet glacé qui glisse au survol */}
      <div className="pointer-events-none absolute inset-0" style={{ background: theme.texture }} />
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: theme.glow }} />
      <Waves color={theme.wave} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(115deg, transparent 30%, ${theme.shine} 45%, transparent 60%)` }}
      />
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative flex h-full flex-col justify-between">{children}</div>
    </div>
  );
}

// Émetteur + gamme + sans contact
function CardHeader({ theme }: { theme: Theme }) {
  const emboss = { textShadow: theme.emboss };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2" style={{ color: theme.accent }}>
        <LogoMark className="h-7 w-auto" />
        <span className="text-sm font-bold tracking-[0.18em]" style={emboss}>AUTO HEAL</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: theme.accent, ...emboss }}>{theme.name}</span>
        <Contactless />
      </div>
    </div>
  );
}

// Numéro masqué en relief (4 groupes espacés) + titulaire
function CardFooter({ theme, last4, holder }: { theme: Theme; last4: string; holder: string }) {
  const emboss = { textShadow: theme.emboss };
  return (
    <>
      <p className="flex gap-4 pr-2 font-mono text-[17px] tracking-[0.12em]" style={emboss} aria-label={`Carte se terminant par ${last4}`}>
        <span>••••</span>
        <span>••••</span>
        <span>••••</span>
        <span>{last4}</span>
      </p>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={label}>Titulaire</p>
          <p className="truncate text-base font-semibold uppercase tracking-[0.12em]" style={emboss}>{holder}</p>
        </div>
        <div className="text-right">
          <p className={label}>Compte</p>
          <p className="text-sm font-semibold tracking-[0.15em]">COURANT</p>
        </div>
      </div>
    </>
  );
}

// Carte vitrine (page de connexion) : même design, sans solde
export function ShowcaseCard({ index, holder, last4 }: { index: number; holder: string; last4: string }) {
  const theme = THEMES[index % THEMES.length];
  return (
    <CardShell theme={theme} className="p-5 shadow-black/50">
      <CardHeader theme={theme} />
      <Chip />
      <CardFooter theme={theme} last4={last4} holder={holder} />
    </CardShell>
  );
}

interface Props {
  account: Account;
  index: number;
  hidden: boolean;          // soldes masqués (partagé par toutes les cartes)
  onToggleHidden: () => void;
}

// Carte bancaire fictive : numéro toujours masqué, aucune marque de réseau réelle
export default function BankCard({ account, index, hidden, onToggleHidden }: Props) {
  const theme = THEMES[index % THEMES.length];
  return (
    <CardShell
      theme={theme}
      className="p-6 shadow-slate-900/25 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-slate-900/35"
    >
      <CardHeader theme={theme} />

      {/* Puce + solde */}
      <div className="flex items-center justify-between">
        <Chip />
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <p className={label}>Solde disponible</p>
            <button
              type="button"
              onClick={onToggleHidden}
              aria-label={hidden ? "Afficher les soldes" : "Masquer les soldes"}
              title={hidden ? "Afficher les soldes" : "Masquer les soldes"}
              className="rounded-full p-1 opacity-70 transition hover:bg-black/10 hover:opacity-100"
            >
              <Eye open={!hidden} />
            </button>
          </div>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
            {hidden ? <span className="tracking-[0.15em]">•••••• €</span> : formatEuros(account.balance)}
          </p>
        </div>
      </div>

      <CardFooter theme={theme} last4={String(account.id).padStart(4, "0")} holder={account.owner} />
    </CardShell>
  );
}
