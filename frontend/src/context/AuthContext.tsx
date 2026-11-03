import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api";
import { refreshSession, setAuthFailureHandler, tokenStore } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean; // true while we check whether a session cookie exists
  login: (organizationSlug: string, email: string, password: string) => Promise<User>;
  registerOrg: (body: { organizationName: string; organizationSlug: string; name: string; email: string; password: string }) => Promise<User>;
  registerCustomer: (body: { organizationSlug: string; name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);
export const LAST_ORG_KEY = "resolvex:lastOrg";

function rememberOrg(slug: string) {
  try { localStorage.setItem(LAST_ORG_KEY, slug); } catch { /* storage may be blocked: not essential */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load, try to restore the session from the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then((session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    setAuthFailureHandler(() => { tokenStore.set(null); setUser(null); });
    return () => { cancelled = true; setAuthFailureHandler(null); };
  }, []);

  const accept = useCallback((data: { user: User; accessToken: string }, slug: string) => {
    tokenStore.set(data.accessToken);
    rememberOrg(slug);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (slug, email, password) => accept(await authApi.login({ organizationSlug: slug, email, password }), slug),
      registerOrg: async (body) => accept(await authApi.registerOrg(body), body.organizationSlug),
      registerCustomer: async (body) => accept(await authApi.registerCustomer(body), body.organizationSlug),
      logout: async () => {
        try { await authApi.logout(); } finally { tokenStore.set(null); setUser(null); }
      },
      setUser,
    }),
    [user, loading, accept]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
