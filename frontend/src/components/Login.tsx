import { FormEvent, useState } from "react";

import { ApiError, api } from "../api";

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-black shadow-lg">
            R
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">RESILIENCE-ALPHA</h1>
            <p className="text-xs text-slate-300">Plateforme de paiement · Groupe 12</p>
          </div>
        </div>

        <div className="card card-pad">
          <h2 className="text-lg font-semibold text-slate-900">Connexion</h2>
          <p className="mt-1 text-sm text-slate-500">Accédez à la console de supervision.</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label">Utilisateur</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="operator / admin"
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">⚠ {error}</p>
            )}
            <button className="btn btn-primary w-full" disabled={loading || !password}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Connexion chiffrée (TLS) · jeton JWT en mémoire uniquement
        </p>
      </div>
    </div>
  );
}
