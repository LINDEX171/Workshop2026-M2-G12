import { FormEvent, useCallback, useEffect, useState } from "react";

import { Account, ApiError, Transaction, api } from "../api";
import { formatEuros, formatTime } from "../format";

interface Props {
  token: string | null;
  onLogin: (token: string) => void;
  onLogout: () => void;
}

export default function Payment({ token, onLogin, onLogout }: Props) {
  return token ? <Dashboard token={token} onLogout={onLogout} /> : <LoginForm onLogin={onLogin} />;
}

const card = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";
const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("operator");
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
      setError(err instanceof ApiError && err.status === 401 ? "Identifiants invalides" : String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${card} mx-auto max-w-sm`}>
      <h2 className="mb-4 text-lg font-semibold">Connexion opérateur</h2>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Utilisateur</span>
          <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Mot de passe</span>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-slate-900">⚠ {error}</p>}
        <button className={`${button} w-full`} disabled={loading || !password}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [src, setSrc] = useState(1);
  const [dst, setDst] = useState(2);
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onLogout(); // token expiré
      return err instanceof Error ? err.message : String(err);
    },
    [onLogout],
  );

  const refresh = useCallback(async () => {
    try {
      const [acc, txs] = await Promise.all([api.accounts(token), api.transactions(token)]);
      setAccounts(acc);
      setTransactions(txs);
      setLoadError(null);
    } catch (err) {
      setLoadError(handleError(err));
    }
  }, [token, handleError]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      const tx = await api.createTransaction(token, src, dst, Number(amount));
      setMessage({ ok: true, text: `Transaction #${tx.id} acceptée` });
    } catch (err) {
      setMessage({ ok: false, text: handleError(err) });
    } finally {
      setSending(false);
      refresh();
    }
  }

  const owner = (id: number) => accounts.find((a) => a.id === id)?.owner ?? `#${id}`;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-lg border border-critical bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-critical">✕</span> Service de paiement indisponible : {loadError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {accounts.map((a) => (
          <div key={a.id} className={card}>
            <p className="text-sm text-slate-500">Compte #{a.id}</p>
            <p className="text-lg font-semibold">{a.owner}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{formatEuros(a.balance)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nouveau virement</h2>
            <button onClick={onLogout} className="text-sm text-slate-500 hover:text-slate-900">
              Déconnexion
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Compte débité</span>
              <select className={input} value={src} onChange={(e) => setSrc(Number(e.target.value))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.owner}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Bénéficiaire</span>
              <select className={input} value={dst} onChange={(e) => setDst(Number(e.target.value))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.owner}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Montant (€)</span>
              <input
                className={input}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {message && (
              <p className="text-sm">
                <span className={`font-semibold ${message.ok ? "text-good" : "text-critical"}`}>
                  {message.ok ? "✓" : "✕"}
                </span>{" "}
                {message.text}
              </p>
            )}
            <button className={`${button} w-full`} disabled={sending || src === dst || !(Number(amount) > 0)}>
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </form>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-4 text-lg font-semibold">Dernières transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune transaction pour l'instant.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Heure</th>
                  <th className="pb-2 font-medium">De</th>
                  <th className="pb-2 font-medium">Vers</th>
                  <th className="pb-2 text-right font-medium">Montant</th>
                  <th className="pb-2 pl-4 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2 tabular-nums text-slate-500">{t.id}</td>
                    <td className="py-2 tabular-nums">{formatTime(t.created_at)}</td>
                    <td className="py-2">{owner(t.src)}</td>
                    <td className="py-2">{owner(t.dst)}</td>
                    <td className="py-2 text-right tabular-nums">{formatEuros(t.amount)}</td>
                    <td className="py-2 pl-4">
                      <span className={`font-semibold ${t.status === "accepted" ? "text-good" : "text-critical"}`}>
                        {t.status === "accepted" ? "✓" : "✕"}
                      </span>{" "}
                      {t.status === "accepted" ? "Acceptée" : "Rejetée"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
