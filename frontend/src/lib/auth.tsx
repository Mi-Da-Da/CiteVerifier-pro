import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

type AuthCtx = {
  email: string | null;
  login: (email: string) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "ghostcite.auth.email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setEmail(v);
    } catch {}
  }, []);

  const login = useCallback((e: string) => {
    setEmail(e);
    try { localStorage.setItem(KEY, e); } catch {}
  }, []);

  const logout = useCallback(() => {
    setEmail(null);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return <Ctx.Provider value={{ email, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
