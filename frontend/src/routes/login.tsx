import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — CiteVerifier" },
      { name: "description", content: "Sign in to CiteVerifier." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const t = useT();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = username.trim().length > 0 && password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr("");
    setLoading(true);
    try {
      const data = await apiClient.login({ username: username.trim(), password });
      if (data.success) {
        login(username.trim());
        navigate({ to: "/" });
      } else {
        setErr(data.message || t({ zh: "用户名或密码错误。", en: "Incorrect username or password." }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t({ zh: "网络错误，请稍后再试。", en: "Network error. Please try again." }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="liquid-glass rounded-3xl p-8 sm:p-10 w-full max-w-md animate-blur-fade-up">
          <h1 className="text-3xl font-normal mb-2" style={{ letterSpacing: "-0.03em" }}>
            {t({ zh: "欢迎回来。", en: "Welcome back." })}
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            {t({ zh: "登录，继续检测。", en: "Sign in to keep verifying." })}
          </p>

          <label className="block text-sm mb-2">{t({ zh: "用户名", en: "Username" })}</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors mb-5"
            placeholder={t({ zh: "请输入用户名", en: "Enter your username" })}
          />

          <label className="block text-sm mb-2">{t({ zh: "密码", en: "Password" })}</label>
          <div className="relative mb-2">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:border-white/30 transition-colors"
              placeholder={t({ zh: "至少 6 位", en: "At least 6 characters" })}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && <p className="text-sm text-red-400 mb-3">{err}</p>}

          <button type="submit" disabled={!valid || loading}
            className="w-full mt-6 bg-white text-black rounded-xl font-medium py-3 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? t({ zh: "登录中…", en: "Signing in…" }) : t({ zh: "登录", en: "Sign in" })}
          </button>

          <div className="flex items-center justify-end mt-6 text-sm text-gray-400">
            <Link to="/register" className="hover:text-white transition-colors">
              {t({ zh: "注册账号", en: "Create account" })}
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
