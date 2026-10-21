import { FormEvent, ReactNode, useState } from "react";

import { ApiError, api } from "../api";
import CardStack from "./CardStack";
import { Logo } from "./Logo";

// Grille discrète en fond du panneau de marque
const GRID = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

const FEATURES = [
  "Détection d'anomalies en temps réel",
  "Remédiation automatique des incidents",
  "Flux chiffrés TLS, sessions JWT non persistées",
];

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login(username, password);
      onLogin(token);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Identifiants invalides."
          : "Service indisponible. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Panneau de marque (grand écran) */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#0B1620] p-12 text-white lg:flex" style={GRID}>
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#0E8A66]/20 blur-3xl" />

        <Logo className="relative h-12" />

        {/* Les 3 cartes empilées en 3D (soulevées et écartées au survol) ; réduites sur les écrans bas */}
        <CardStack className="mx-auto h-[18rem] w-full max-w-[28rem] shrink-0 [@media(max-height:820px)]:h-[13rem] [@media(max-height:820px)]:scale-[0.72]" />

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Paiements résilients,
            <br />
            supervision continue.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0E8A66]/20 text-[#34D399]">
                  <Icon className="h-3.5 w-3.5">
                    <path d="M5 12l5 5 9-11" />
                  </Icon>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© 2026 Resilience Alpha</p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 h-10 text-[#0B1620] lg:hidden" />

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-500">Identifiez-vous pour accéder à la console.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Identifiant
              </label>
              <input
                id="username"
                className="input py-2.5"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="input py-2.5 pr-11"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  <Icon className="h-4.5 w-4.5">
                    {showPassword ? (
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.3M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
                    ) : (
                      <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    )}
                  </Icon>
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-critical">
                <Icon className="h-4 w-4 shrink-0">
                  <path d="M12 8v4M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
                </Icon>
                {error}
              </div>
            )}

            <button
              className="btn w-full bg-[#0B1620] py-2.5 text-white shadow-sm hover:bg-[#1a2a38]"
              disabled={loading || !username || !password}
            >
              {loading && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-8 flex items-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400">
            <Icon className="h-4 w-4">
              <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" />
            </Icon>
            Connexion chiffrée (TLS) · jeton conservé en mémoire uniquement
          </p>
        </div>
      </main>
    </div>
  );
}
