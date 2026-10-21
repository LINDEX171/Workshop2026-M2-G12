import { ReactNode, useState } from "react";

import AssistantWidget from "./components/AssistantWidget";
import Login from "./components/Login";
import { Logo, LogoMark } from "./components/Logo";
import Home from "./pages/Home";
import Payment from "./pages/Payment";
import Supervision from "./pages/Supervision";

type Tab = "home" | "payment" | "supervision";

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? "http://localhost:3000";

const NAV: { id: Tab; label: string; subtitle: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "Accueil",
    subtitle: "Vue d'ensemble de la plateforme",
    icon: <path d="M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />,
  },
  {
    id: "payment",
    label: "Paiement",
    subtitle: "Comptes et transactions de la plateforme",
    icon: (
      <path d="M3 10h18M6 15h4M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    ),
  },
  {
    id: "supervision",
    label: "Supervision",
    subtitle: "État des services, détection et remédiation",
    icon: <path d="M3 12h4l2 6 4-14 2 8h6" />,
  },
];

function identity(token: string): { sub: string; role: string } | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");

  if (!token) return <Login onLogin={setToken} />;

  const me = identity(token);
  const current = NAV.find((n) => n.id === tab)!;

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <Logo className="h-10 text-[#0B1620]" />
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === n.id
                  ? "bg-brand/10 text-brand"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                {n.icon}
              </svg>
              {n.label}
            </button>
          ))}
        </nav>

        <a
          href={GRAFANA_URL}
          target="_blank"
          rel="noreferrer"
          className="mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
          </svg>
          Grafana
        </a>

        <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold uppercase text-white">
            {me?.sub?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-900">{me?.sub ?? "Utilisateur"}</p>
            <p className="text-xs capitalize text-slate-400">{me?.role ?? ""}</p>
          </div>
          <button
            onClick={() => setToken(null)}
            title="Déconnexion"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-critical"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-auto shrink-0 text-[#0B1620] md:hidden" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{current.label}</h1>
              <p className="text-sm text-slate-500">{current.subtitle}</p>
            </div>
          </div>
          {/* Navigation mobile */}
          <nav className="flex gap-1 md:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  tab === n.id ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {tab === "home" && (
            <Home token={token} user={me?.sub ?? null} shortcuts={NAV.filter((n) => n.id !== "home")} onOpen={setTab} />
          )}
          {tab === "payment" &&<Payment token={token} onLogout={() => setToken(null)} />}
          {tab === "supervision" && <Supervision token={token} />}
        </main>
      </div>

      {/* Assistant flottant, disponible sur toutes les pages (démonté à la déconnexion) */}
      <AssistantWidget token={token} />
    </div>
  );
}
