import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, demoApi } from "../api";
import { refreshSession, setAuthFailureHandler, tokenStore } from "../api/client";
import type { Role, User } from "../types";

export const IS_DEMO_KEY = "resolvex:isDemoMode";
export const LAST_ORG_KEY = "resolvex:lastOrg";

interface AuthState {
  user: User | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (organizationSlug: string, email: string, password: string) => Promise<User>;
  registerOrg: (body: { organizationName: string; organizationSlug: string; name: string; email: string; password: string }) => Promise<User>;
  registerCustomer: (body: { organizationSlug: string; name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  enterDemo: (role?: Role) => Promise<User>;
  switchDemoRole: (role: Role) => Promise<User>;
  resetDemo: () => Promise<User>;
  exitDemo: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function rememberOrg(slug: string) {
  try { localStorage.setItem(LAST_ORG_KEY, slug); } catch { /* storage optional */ }
}

function setDemoStorage(isDemo: boolean) {
  try {
    if (isDemo) localStorage.setItem(IS_DEMO_KEY, "true");
    else localStorage.removeItem(IS_DEMO_KEY);
  } catch { /* storage optional */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load, try to restore the session from the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then((session) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u?.isDemo || u?.email?.endsWith("@resolvex.demo")) {
        setDemoStorage(true);
      }
      setLoading(false);
    });
    setAuthFailureHandler(() => {
      tokenStore.set(null);
      setUser(null);
      setDemoStorage(false);
    });
    return () => { cancelled = true; setAuthFailureHandler(null); };
  }, []);

  const isDemoMode = useMemo(() => {
    if (user?.isDemo || user?.email?.endsWith("@resolvex.demo")) return true;
    try {
      return localStorage.getItem(IS_DEMO_KEY) === "true";
    } catch {
      return false;
    }
  }, [user]);

  const accept = useCallback((data: { user: User; accessToken: string }, slug: string, isDemo = false) => {
    tokenStore.set(data.accessToken);
    rememberOrg(slug);
    setDemoStorage(isDemo);
    setUser({ ...data.user, isDemo });
    return data.user;
  }, []);

  const enterDemo = useCallback(async (role: Role = "CUSTOMER") => {
    const res = await demoApi.createSession(role);
    return accept(res, res.organization.slug, true);
  }, [accept]);

  const switchDemoRole = useCallback(async (role: Role) => {
    const res = await demoApi.createSession(role);
    return accept(res, res.organization.slug, true);
  }, [accept]);

  const resetDemo = useCallback(async () => {
    const res = await demoApi.reset();
    return accept(res, res.organization.slug, true);
  }, [accept]);

  const exitDemo = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      tokenStore.set(null);
      setUser(null);
      setDemoStorage(false);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isDemoMode,
      login: async (slug, email, password) => accept(await authApi.login({ organizationSlug: slug, email, password }), slug, false),
      registerOrg: async (body) => accept(await authApi.registerOrg(body), body.organizationSlug, false),
      registerCustomer: async (body) => accept(await authApi.registerCustomer(body), body.organizationSlug, false),
      logout: async () => {
        try { await authApi.logout(); } finally {
          tokenStore.set(null);
          setUser(null);
          setDemoStorage(false);
        }
      },
      enterDemo,
      switchDemoRole,
      resetDemo,
      exitDemo,
      setUser,
    }),
    [user, loading, isDemoMode, accept, enterDemo, switchDemoRole, resetDemo, exitDemo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
