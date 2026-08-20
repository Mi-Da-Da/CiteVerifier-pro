import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { apiClient } from "@/lib/api-client";

type AuthCtx = {
  username: string | null;
  ready: boolean;
  isLoggedIn: boolean;
  login: (username: string) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 启动时调 /api/user/me 确认登录态（依赖 cookie，不再读 localStorage）
  useEffect(() => {
    let active = true;
    apiClient.getMe()
      .then((data) => {
        if (active && data.success && data.username) {
          setUsername(data.username);
        }
      })
      .catch(() => {
        // 401 = 未登录，静默处理
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  const login = useCallback((name: string) => {
    setUsername(name);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // 即使后端调用失败也清除前端状态
    }
    setUsername(null);
  }, []);

  return (
    <Ctx.Provider value={{ username, ready, isLoggedIn: Boolean(username), login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
