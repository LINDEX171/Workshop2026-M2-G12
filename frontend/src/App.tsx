import { useState } from "react";

import Payment from "./pages/Payment";
import Supervision from "./pages/Supervision";

type Tab = "payment" | "supervision";

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? "http://localhost:3000";

const TABS: { id: Tab; label: string }[] = [
  { id: "payment", label: "Paiement" },
  { id: "supervision", label: "Supervision" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("payment");
  // Token JWT gardé en mémoire uniquement (jamais dans localStorage)
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">RESILIENCE-ALPHA</h1>
            <p className="text-sm text-slate-500">Plateforme de paiement — Groupe 12</p>
          </div>
          <nav className="flex items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
            <a
              href={GRAFANA_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Grafana ↗
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {tab === "payment" ? (
          <Payment token={token} onLogin={setToken} onLogout={() => setToken(null)} />
        ) : (
          <Supervision />
        )}
      </main>
    </div>
  );
}
