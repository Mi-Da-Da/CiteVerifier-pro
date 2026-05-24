import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

type AuthCtx = {
  user: { username: string; userId: number } | null;
  isAuthenticated: boolean;
  login: (username: string, userId: number) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = "ghostcite.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ username: string; userId: number } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(USER_KEY);
      if (v) {
        setUser(JSON.parse(v));
      }
    } catch {}
  }, []);

  const login = useCallback((username: string, userId: number) => {
    const userData = { username, userId };
    setUser(userData);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      isAuthenticated: user !== null,
      login,
      logout
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
