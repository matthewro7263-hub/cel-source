import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ─── Bearer-token store ──────────────────────────────────────────────────────
// Token is kept in module-level state (no localStorage — iframe-safe).
// Call setAuthToken() before any query/mutation that needs auth.
let authToken: string | null = null;

// Subscribers notified when a 401 lands — used by AuthProvider to clear user
// state and redirect to /login, instead of crashing the React tree.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function notifyUnauthorized() {
  authToken = null;
  Array.from(unauthorizedListeners).forEach((fn) => {
    try { fn(); } catch { /* swallow listener errors so one bad listener can't blank the app */ }
  });
}

export function setAuthToken(t: string | null) {
  authToken = t;
}

export function getAuthToken(): string | null {
  return authToken;
}
// ────────────────────────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = authHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      // Centralized 401 handling: drop token, ping listeners (AuthProvider clears
      // user + router redirects to /login). Returning null prevents the query
      // from throwing into the React render tree and blanking the app.
      notifyUnauthorized();
      if (unauthorizedBehavior === "returnNull") return null;
      // Even when caller asked for "throw", we throw a tagged error that
      // ErrorBoundary will catch gracefully rather than letting an unhandled
      // promise rejection escape.
      const err = new Error("401: unauthorized");
      (err as Error & { code?: string }).code = "UNAUTHORIZED";
      throw err;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // returnNull on 401 by default so a stale token doesn't unmount the app.
      // Pages that genuinely need to react to 401 can subscribe via onUnauthorized.
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
