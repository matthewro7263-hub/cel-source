import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ── Bearer-token store ────────────────────────────────────────────────────
// Persisted to localStorage so the token survives hash-router navigations
// and React re-renders without re-authenticating.
const LS_KEY = "cel_auth_token";
let authToken: string | null = (() => {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
})();

// Subscribers notified when a 401 lands – used by AuthProvider to clear user
// state and redirect to /login, instead of crashing the React tree.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function notifyUnauthorized() {
  authToken = null;
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  Array.from(unauthorizedListeners).forEach((fn) => {
    try { fn(); } catch { /* swallow listener errors so one bad listener can't blank the app */ }
  });
}

export function setAuthToken(t: string | null) {
  authToken = t;
  try {
    if (t) { localStorage.setItem(LS_KEY, t); }
    else   { localStorage.removeItem(LS_KEY); }
  } catch { /* ignore – Safari private mode throws on localStorage writes */ }
}

export function getAuthToken(): string | null {
  return authToken;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers = authHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (res.status === 401) notifyUnauthorized();
  return res;
}

function formatApiError(status: number, text: string): string {
  if (status === 401) return "Session expired — please log in again.";
  if (status === 413) return "File too large — try a smaller upload.";
  return `${status}: ${text}`;
}

/** Build an API URL from a React Query key (e.g. ["/api/projects", 5, "storyboards"]). */
export function buildQueryUrl(queryKey: readonly unknown[]): string {
  if (queryKey.length === 0) return "";
  if (queryKey.length === 1 && typeof queryKey[0] === "string") {
    const path = queryKey[0];
    return path.startsWith("/") ? path : `/${path}`;
  }

  let url = "";
  for (let i = 0; i < queryKey.length; i++) {
    const part = queryKey[i];
    if (part === null || part === undefined) continue;
    if (typeof part === "object") continue;

    const segment = String(part);
    if (i === 0) {
      url = segment.startsWith("/") ? segment : `/${segment}`;
    } else {
      url += segment.startsWith("/") ? segment : `/${segment}`;
    }
  }
  return url;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: (options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${buildQueryUrl(queryKey)}`, {
      headers: authHeaders(),
      credentials: "include",
    });
    if (res.status === 401) {
      notifyUnauthorized();
      if (unauthorizedBehavior === "returnNull") return null;
      throw new Error(formatApiError(401, "Unauthorized"));
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatApiError(res.status, text));
    }
    return res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 min – was 30s which caused constant re-auth
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
