import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";

import { Account, ApiError, Transaction, api } from "../api";
import BankCard from "../components/BankCard";
import { formatAccount, formatDate, formatEuros, formatTime, formatTxRef } from "../format";

interface Props {
  token: string;
  onLogout: () => void;
}

type Filter = "all" | "accepted" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "accepted", label: "Acceptées" },
  { id: "rejected", label: "Rejetées" },
];

const QUICK_AMOUNTS = [10, 50, 100, 250];

// Pastilles aux couleurs des cartes (Black, Gold, Metal)
const AVATARS = [
  "bg-neutral-900 text-amber-300",
  "bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800",
];

function Svg({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export default function Payment({ token, onLogout }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [src, setSrc] = useState(1);
  const [dst, setDst] = useState(2);
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

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
      setMessage({ ok: true, text: `Virement ${formatTxRef(tx.id)} accepté` });
    } catch (err) {
      setMessage({ ok: false, text: handleError(err) });
    } finally {
      setSending(false);
      refresh();
    }
  }

  function swap() {
    setSrc(dst);
    setDst(src);
  }

  const indexOf = (id: number) => Math.max(accounts.findIndex((a) => a.id === id), 0);
  const owner = (id: number) => accounts.find((a) => a.id === id)?.owner ?? `#${id}`;
  const srcAccount = accounts.find((a) => a.id === src);
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const shown = filter === "all" ? transactions : transactions.filter((t) => t.status === filter);
  const canSend = !sending && src !== dst && Number(amount) > 0;

  const avatar = (id: number) => (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATARS[indexOf(id) % AVATARS.length]}`}>
      {owner(id)[0]}
    </span>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">
          <span className="font-semibold">✕</span> Service de paiement indisponible : {loadError}
        </div>
      )}

      {/* --- Comptes --- */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mes comptes</h2>
            <p className="text-sm text-slate-500">
              {accounts.length} comptes courants · solde total{" "}
              <span className="font-semibold tabular-nums text-slate-800">{balancesHidden ? "•••••• €" : formatEuros(total)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBalancesHidden((h) => !h)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Svg className="h-4 w-4">
              {balancesHidden ? (
                <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              ) : (
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.3M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
              )}
            </Svg>
            {balancesHidden ? "Afficher les soldes" : "Masquer les soldes"}
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.length === 0
            ? Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[1.586] animate-pulse rounded-[1.25rem] bg-slate-200" />)
            : accounts.map((a, i) => (
                <BankCard key={a.id} account={a} index={i} hidden={balancesHidden} onToggleHidden={() => setBalancesHidden((h) => !h)} />
              ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* --- Virement --- */}
        <section className="card card-pad lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Svg><path d="M7 17L17 7M17 7H9M17 7v8" /></Svg>
            </span>
            <div>
              <h2 className="font-semibold text-slate-900">Nouveau virement</h2>
              <p className="text-xs text-slate-500">Instantané, entre comptes de la plateforme</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="relative space-y-2">
              <div>
                <label className="label">Depuis</label>
                <select className="input py-2.5" value={src} onChange={(e) => setSrc(Number(e.target.value))}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.owner} · {formatAccount(a.id)}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={swap}
                title="Inverser débiteur et bénéficiaire"
                aria-label="Inverser débiteur et bénéficiaire"
                className="absolute right-10 top-[3.4rem] z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:rotate-180 hover:text-brand"
              >
                <Svg className="h-4 w-4"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></Svg>
              </button>
              <div>
                <label className="label">Vers</label>
                <select className="input py-2.5" value={dst} onChange={(e) => setDst(Number(e.target.value))}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.owner} · {formatAccount(a.id)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Montant</label>
              <div className="relative">
                <input
                  className="input py-3 pr-10 text-2xl font-semibold tabular-nums"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-lg font-semibold text-slate-400">€</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      Number(amount) === v ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand"
                    }`}
                  >
                    {v} €
                  </button>
                ))}
              </div>
              {srcAccount && !balancesHidden && (
                <p className="mt-2 text-xs text-slate-400">
                  Solde disponible : <span className="font-medium tabular-nums text-slate-600">{formatEuros(srcAccount.balance)}</span>
                </p>
              )}
            </div>

            {src === dst ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Le compte débité et le bénéficiaire doivent être différents.</p>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <span className="flex items-center gap-2">{avatar(src)} {owner(src)}</span>
                <Svg className="h-4 w-4 text-slate-400"><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
                <span className="flex items-center gap-2">{owner(dst)} {avatar(dst)}</span>
              </div>
            )}

            {message && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${message.ok ? "bg-green-50 text-good" : "bg-red-50 text-critical"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${message.ok ? "bg-good" : "bg-critical"}`}>
                  {message.ok ? "✓" : "✕"}
                </span>
                {message.text}
              </div>
            )}

            <button className="btn btn-primary w-full py-3 text-base" disabled={!canSend}>
              {sending ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Envoi…
                </>
              ) : (
                <>Envoyer {Number(amount) > 0 ? formatEuros(Number(amount)) : ""}</>
              )}
            </button>
          </form>
        </section>

        {/* --- Historique --- */}
        <section className="card flex flex-col lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Historique</h2>
              <p className="text-xs text-slate-500">{transactions.length} dernières transactions · mise à jour automatique</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    filter === f.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Svg className="h-6 w-6"><path d="M3 10h18M6 15h4M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></Svg>
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700">Aucune transaction</p>
              <p className="mt-1 text-xs text-slate-400">Les virements apparaîtront ici en temps réel.</p>
            </div>
          ) : (
            <ul className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
              {shown.map((t) => {
                const ok = t.status === "accepted";
                return (
                  <li key={t.id} className="flex items-center gap-4 px-6 py-3 transition hover:bg-slate-50">
                    <div className="flex -space-x-2">
                      {avatar(t.src)}
                      <span className="ring-2 ring-white rounded-full">{avatar(t.dst)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {owner(t.src)} <span className="text-slate-300">→</span> {owner(t.dst)}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        <span className="font-mono">{formatTxRef(t.id)}</span> · {formatAccount(t.src)} → {formatAccount(t.dst)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${ok ? "text-slate-900" : "text-slate-400 line-through"}`}>
                        {formatEuros(t.amount)}
                      </p>
                      <p className="text-xs tabular-nums text-slate-400">
                        {formatDate(t.created_at)} · {formatTime(t.created_at)}
                      </p>
                    </div>
                    <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${ok ? "bg-green-50 text-good" : "bg-red-50 text-critical"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-good" : "bg-critical"}`} />
                      {ok ? "Acceptée" : "Rejetée"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
