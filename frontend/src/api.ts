// Client HTTP : tous les appels passent par le WAF puis le proxy Nginx du frontend.
//   /api/auth/*  -> auth
//   /api/pay/*   -> payment-api
//   /api/status  -> detector (agrégateur lecture seule)

export interface Account {
  id: number;
  owner: string;
  balance: number;
}

export interface Transaction {
  id: number;
  src: number;
  dst: number;
  amount: number;
  status: "accepted" | "rejected";
  created_at: string;
}

export type ServiceState = "ok" | "ko" | "unknown";
export type Phase = "before" | "during" | "after";

export interface RemediationEvent {
  ts: string;
  type?: string;
  target?: string;
  action?: string;
  status: string;
  detail?: string;
}

export interface PlatformStatus {
  phase: Phase;
  services: Record<string, ServiceState>;
  score: { score: number | null; threshold: number; model_loaded: boolean };
  events: RemediationEvent[];
  generated_at: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

function detailOf(data: unknown): string | null {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Requête invalide";
  }
  return null;
}

async function request<T>(path: string, { method = "GET", body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Serveur injoignable");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detailOf(data) ?? `Erreur ${res.status}`);
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; expires_in: number }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    }),
  accounts: (token: string) => request<Account[]>("/api/pay/accounts", { token }),
  transactions: (token: string) => request<Transaction[]>("/api/pay/transactions?limit=20", { token }),
  createTransaction: (token: string, src: number, dst: number, amount: number) =>
    request<{ id: number; status: string }>("/api/pay/transactions", {
      method: "POST",
      token,
      body: { src, dst, amount },
    }),
  status: () => request<PlatformStatus>("/api/status"),
  ask: (question: string) =>
    request<{ answer: string; sources: string[] }>("/api/assistant/ask", {
      method: "POST",
      body: { question },
    }),
};
