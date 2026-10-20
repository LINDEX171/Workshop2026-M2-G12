import { FormEvent, useCallback, useEffect, useState } from "react";

import { Account, ApiError, Transaction, api } from "../api";
import { formatEuros, formatTime } from "../format";

interface Props {
  token: string;
  onLogout: () => void;
}

const AVATAR_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-rose-500"];

export default function Payment({ token, onLogout }: Props) {
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
      if (err instanceof ApiError && err.status === 401) onLogout();
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
      setMessage({ ok: true, text: `Virement #${tx.id} accepté` });
    } catch (err) {
      setMessage({ ok: false, text: handleError(err) });
    } finally {
      setSending(false);
      refresh();
    }
  }

  const owner = (id: number) => accounts.find((a) => a.id === id)?.owner ?? `#${id}`;
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">
          <span className="font-semibold">✕</span> Service de paiement indisponible : {loadError}
        </div>
      )}

      {/* Comptes */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((a, i) => (
          <div key={a.id} className="card card-pad">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                {a.owner[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{a.owner}</p>
                <p className="text-xs text-slate-400">Compte #{a.id}</p>
              </div>
            </div>
            <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{formatEuros(a.balance)}</p>
          </div>
        ))}
        <div className="card card-pad bg-slate-900 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total plateforme</p>
          <p className="mt-4 text-2xl font-bold tabular-nums">{formatEuros(total)}</p>
          <p className="mt-1 text-xs text-slate-400">Conservé (intégrité)</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Virement */}
        <section className="card card-pad lg:col-span-1">
          <h2 className="card-title">Nouveau virement</h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="label">Compte débité</label>
              <select className="input" value={src} onChange={(e) => setSrc(Number(e.target.value))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.owner}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bénéficiaire</label>
              <select className="input" value={dst} onChange={(e) => setDst(Number(e.target.value))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.owner}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input className="input" type="number" min="0.01" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            {message && (
              <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-good" : "bg-red-50 text-critical"}`}>
                {message.ok ? "✓" : "✕"} {message.text}
              </p>
            )}
            <button className="btn btn-primary w-full" disabled={sending || src === dst || !(Number(amount) > 0)}>
              {sending ? "Envoi…" : "Envoyer le virement"}
            </button>
            {src === dst && <p className="text-xs text-amber-600">Le débiteur et le bénéficiaire doivent différer.</p>}
          </form>
        </section>

        {/* Transactions */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="card-title">Dernières transactions</h2>
            <span className="badge bg-slate-100 text-slate-500">{transactions.length}</span>
          </div>
          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">Aucune transaction pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Heure</th>
                    <th className="py-2 font-medium">De → Vers</th>
                    <th className="py-2 text-right font-medium">Montant</th>
                    <th className="px-6 py-2 text-right font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-2.5 tabular-nums text-slate-400">{t.id}</td>
                      <td className="py-2.5 tabular-nums text-slate-500">{formatTime(t.created_at)}</td>
                      <td className="py-2.5 text-slate-700">{owner(t.src)} <span className="text-slate-300">→</span> {owner(t.dst)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{formatEuros(t.amount)}</td>
                      <td className="px-6 py-2.5 text-right">
                        <span className={`badge ${t.status === "accepted" ? "bg-green-50 text-good" : "bg-red-50 text-critical"}`}>
                          {t.status === "accepted" ? "✓ Acceptée" : "✕ Rejetée"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
