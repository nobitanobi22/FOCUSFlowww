import {
  TokenResponse,
  SessionSummary,
  SessionDetail,
  MetricsSummary,
  PatternOut,
  DriftPoint,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("email");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const api = {
  register: (email: string, password: string) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // ── Sessions ────────────────────────────────────────────────────────────────

  startSession: (intent: string, duration_minutes: number = 60) =>
    request<{ session_id: string; intent_expanded: any; state: string }>(
      "/sessions/start",
      { method: "POST", body: JSON.stringify({ intent, duration_minutes }) }
    ),

  endSession: (session_id: string) =>
    request("/sessions/end", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),

  listSessions: () => request<SessionSummary[]>("/sessions"),

  getSession: (id: string) => request<SessionDetail>(`/sessions/${id}`),

  // ── Metrics ─────────────────────────────────────────────────────────────────

  getMetricsSummary: () => request<MetricsSummary>("/metrics/summary"),

  getPatterns: () => request<PatternOut>("/metrics/patterns"),

  getSessionCurve: (id: string) =>
    request<DriftPoint[]>(`/metrics/sessions/${id}/curve`),
};
