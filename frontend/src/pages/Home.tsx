import { ReactNode } from "react";

import { Logo } from "../components/Logo";

interface Shortcut<T extends string> {
  id: T;
  label: string;
  subtitle: string;
  icon: ReactNode;
}

interface Props<T extends string> {
  user: string | null;
  shortcuts: Shortcut<T>[];
  onOpen: (id: T) => void;
}

// Page d'accueil : logo, bienvenue et accès rapide aux autres onglets
export default function Home<T extends string>({ user, shortcuts, onOpen }: Props<T>) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="card card-pad flex flex-col items-center py-10 text-center">
        <Logo className="h-20 max-w-full text-[#0B1620] sm:h-24" />
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Bienvenue{user ? `, ${user}` : ""}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Plateforme de paiement résiliente du Groupe 12 : détection d'anomalies, remédiation
          automatique et supervision en temps réel.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {shortcuts.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="card card-pad text-left transition hover:border-brand/40 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                {s.icon}
              </svg>
            </span>
            <p className="mt-4 font-semibold text-slate-900">{s.label}</p>
            <p className="mt-1 text-sm text-slate-500">{s.subtitle}</p>
          </button>
        ))}
      </section>
    </div>
  );
}
