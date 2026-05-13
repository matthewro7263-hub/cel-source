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

async function fetchMe(): Promise<AuthUser | null> {
  const token = getAuthToken();
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch(API_BASE + "/api/auth/me", { headers });
    if (r.status === 401) return null;
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // tokenUser: user set immediately on login (before /api/auth/me refetch)
  const [tokenUser, setTokenUser] = useState<AuthUser | null>(null);

  const q = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    staleTime: 1000 * 30,
  });

  /**
   * Call this right after login/signup with the returned token + user.
   * 1. Set module-level token synchronously (future requests authed).
   * 2. Seed React Query's /api/auth/me cache with the user so any consumer
   *    reading via useQuery sees the user IMMEDIATELY — no flash to /login.
   *    (Previously we used invalidateQueries, which forced a refetch and left
   *    a stale `null` in the cache during the next render — ProtectedShell
   *    saw user=null and bounced back to /login. That's why login needed
   *    two clicks.)
   * 3. Stash in local state too as a belt-and-suspenders fallback.
   */
  const applyToken = useCallback((token: string, user: AuthUser) => {
    setAuthToken(token);
    queryClient.setQueryData(["/api/auth/me"], user);
    setTokenUser(user);
  }, []);

  // When any query gets a 401, drop the user from cache so ProtectedShell
  // redirects to /login instead of blanking. Avoids the silent-blank failure
  // mode where a stale token leaves the user state stuck on a non-existent user.
  useEffect(() => {
    return onUnauthorized(() => {
      setTokenUser(null);
      queryClient.setQueryData(["/api/auth/me"], null);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // best-effort
    }
    setAuthToken(null);
    setTokenUser(null);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.clear();
  }, []);

  // Prefer tokenUser (set synchronously on login) over async query result
  const user = tokenUser ?? q.data ?? null;
  // Don't show "loading" if we already have a user from either source —
  // this prevents the brief flash to <Redirect to="/login" /> right after login.
  const isLoading = !tokenUser && !q.data && q.isLoading;

  return (
    <Ctx.Provider value={{ user, isLoading, applyToken, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
