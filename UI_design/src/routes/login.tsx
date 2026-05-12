import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — GhostCite" },
      { name: "description", content: "Sign in to GhostCite." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

  const valid = username.trim().length > 0 && password.length >= 6;

  //const submit = (e: React.FormEvent) => {
    //e.preventDefault();
    //if (!valid) return;
    //setErr("");
    //navigate({ to: "/" });
  //};
const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!valid) return;
  setErr("");

  try {
    const res = await fetch("/api/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("username", data.username);
      navigate({ to: "/" });
    } else {
      setErr(data.message);
    }
  } catch {
    setErr("网络错误，请稍后重试");
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

          <label className="block text-sm mb-2">{t({ zh: "用户名 / 手机 / 邮箱", en: "Username, phone or email" })}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors mb-5"
            placeholder={t({ zh: "请输入", en: "Enter" })}
          />

          <label className="block text-sm mb-2">{t({ zh: "密码", en: "Password" })}</label>
          <div className="relative mb-2">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:border-white/30 transition-colors"
              placeholder={t({ zh: "至少 6 位", en: "At least 6 characters" })}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              aria-label="toggle password"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && <p className="text-sm text-red-400 mb-3">{err}</p>}

          <button
            type="submit"
            disabled={!valid}
            className="w-full mt-6 bg-white text-black rounded-xl font-medium py-3 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t({ zh: "登录", en: "Sign in" })}
          </button>

          <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
            <button type="button" className="hover:text-white transition-colors">{t({ zh: "忘记密码", en: "Forgot password" })}</button>
            <Link to="/register" className="hover:text-white transition-colors">{t({ zh: "注册账号", en: "Create account" })}</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
