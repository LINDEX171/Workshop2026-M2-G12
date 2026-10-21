import { ReactNode } from "react";

// Grille discrète (même motif que la page de connexion et l'accueil)
const GRID = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

// Couleur du halo selon l'état affiché
const GLOWS = {
  green: "bg-[#0E8A66]/30",
  red: "bg-red-500/30",
  sky: "bg-sky-500/25",
  indigo: "bg-indigo-500/25",
};

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;      // contenu à droite (badges, indicateur…)
  tone?: keyof typeof GLOWS;
  children?: ReactNode;   // contenu sous le titre (étapes, boutons…)
}

// Bandeau sombre en tête de page, commun à l'accueil, la supervision et l'assistant
export default function Hero({ eyebrow, title, description, aside, tone = "green", children }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#0B1620] text-white shadow-xl" style={GRID}>
      <div className={`pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full blur-3xl transition-colors duration-700 ${GLOWS[tone]}`} />
      <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative p-7 md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6EE7B7]">{eyebrow}</p>}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
            {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{description}</p>}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}
