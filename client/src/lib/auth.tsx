import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { setAuthToken, getAuthToken, queryClient, apiRequest, onUnauthorized } from "@/lib/queryClient";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatarColor: string;
}

interface AuthCtx {
  user: AuthUser | null;
  isLoading: boolean;
  /** Call this after a successful login/signup response */
  applyToken: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  isLoading: true,
  applyToken: () => {},
  logout: async () => {},
});

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ── localStorage helpers ────────────────────────────────────────────
const LS_USER_KEY = "cel_auth_user";

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(u: AuthUser | null) {
  try {
    if (u) localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
    else   localStorage.removeItem(LS_USER_KEY);
  } catch { /* ignore */ }
}

async function fetchMe(): Promise<AuthUser | null> {
  const token = getAuthToken();
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch(API_BASE + "/api/auth/me", {
      headers,
      credentials: "include",
    });
    if (r.status === 401) return null;
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // tokenUser: user set immediately on login (before /api/auth/me refetch)
  // Initialized from localStorage so it survives hash-router navigations
  // and React re-renders without requiring a round-trip.
  const [tokenUser, setTokenUser] = useState<AuthUser | null>(() => {
    // If we have a stored token, pre-populate the user from localStorage
    // so ProtectedShell sees a non-null user on the very first render.
    if (getAuthToken()) return readStoredUser();
    return null;
  });

  const q = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    staleTime: 1000 * 60 * 5,
    // Only run the query if we actually have a token
    enabled: !!getAuthToken(),
  });

  const applyToken = useCallback((token: string, user: AuthUser) => {
    setAuthToken(token);
    writeStoredUser(user);
    setTokenUser(user);
    // Seed the React Query cache so no loading flash on first protected render
    queryClient.setQueryData(["/api/auth/me"], user);
  }, []);

  const logout = useCallback(async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch { /* ignore */ }
    setAuthToken(null);
    writeStoredUser(null);
    setTokenUser(null);
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
  }, []);

  // Listen for 401s from anywhere in the app
  useEffect(() => {
    return onUnauthorized(() => {
      writeStoredUser(null);
      setTokenUser(null);
      queryClient.setQueryData(["/api/auth/me"], null);
    });
  }, []);

  // Keep localStorage user in sync with successful /api/auth/me responses
  useEffect(() => {
    if (q.data) {
      writeStoredUser(q.data);
      setTokenUser(q.data);
    }
  }, [q.data]);

  const user = tokenUser ?? q.data ?? null;
  // Only show a loading spinner if we have no user from any source AND
  // a fetch is actually in progress.
  const isLoading = !user && q.isLoading && !!getAuthToken();

  return (
    <Ctx.Provider value={{ user, isLoading, applyToken, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
