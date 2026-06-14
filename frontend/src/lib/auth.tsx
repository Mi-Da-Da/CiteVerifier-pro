import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

type AuthCtx = {
  email: string | null;
  ready: boolean;
  isLoggedIn: boolean;
  login: (email: string) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "ghostcite.auth.email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setEmail(v);
    } catch {
      // localStorage may be unavailable during SSR or in strict privacy modes.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) {
        setEmail(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((e: string) => {
    const value = e.trim();
    setEmail(value);
    try { localStorage.setItem(KEY, value); } catch {}
  }, []);

  const logout = useCallback(() => {
    setEmail(null);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ email, ready, isLoggedIn: Boolean(email), login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
