import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "Create account — GhostCite" },
      { name: "description", content: "Create your GhostCite account." },
    ],
  }),
});

function RegisterPage() {
  const navigate = useNavigate();
  const t = useT();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const usernameOk = /^[A-Za-z0-9_]{3,20}$/.test(username);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const confirmOk = confirm.length > 0 && confirm === password;
  const valid = usernameOk && emailOk && passwordOk && confirmOk;

  const errs = {
    username: username && !usernameOk ? t({ zh: "3–20 位字母、数字或下划线。", en: "3–20 letters, numbers or underscores." }) : "",
    email: email && !emailOk ? t({ zh: "邮箱格式不正确。", en: "Email format isn't valid." }) : "",
    password: password && !passwordOk ? t({ zh: "至少 8 位，含字母与数字。", en: "At least 8 characters, with letters and numbers." }) : "",
    confirm: confirm && !confirmOk ? t({ zh: "两次密码不一致。", en: "Passwords don't match." }) : "",
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    navigate({ to: "/login" });
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="liquid-glass rounded-3xl p-8 sm:p-10 w-full max-w-md animate-blur-fade-up">
          <h1 className="text-3xl font-normal mb-2" style={{ letterSpacing: "-0.03em" }}>
            {t({ zh: "创建账号。", en: "Create account." })}
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            {t({ zh: "加入 GhostCite。从此引用，皆可信。", en: "Join GhostCite. Cite with confidence." })}
          </p>

          <Field label={t({ zh: "用户名", en: "Username" })} value={username} onChange={setUsername}
                 placeholder={t({ zh: "3–20 位字母 / 数字 / 下划线", en: "3–20 letters, numbers or underscores" })} error={errs.username} />
          <Field label={t({ zh: "邮箱", en: "Email" })} value={email} onChange={setEmail}
                 placeholder="you@example.com" error={errs.email} />

          <label className="block text-sm mb-2">{t({ zh: "密码", en: "Password" })}</label>
          <div className="relative mb-1">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:border-white/30 transition-colors"
              placeholder={t({ zh: "至少 8 位，含字母与数字", en: "At least 8 characters, with letters and numbers" })}
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errs.password && <p className="text-xs text-red-400 mb-3">{errs.password}</p>}
          <div className="mb-4" />

          <Field label={t({ zh: "确认密码", en: "Confirm password" })} value={confirm} onChange={setConfirm}
                 placeholder={t({ zh: "再次输入密码", en: "Enter password again" })} error={errs.confirm} type={show ? "text" : "password"} />

          <button
            type="submit"
            disabled={!valid}
            className="w-full mt-4 bg-white text-black rounded-xl font-medium py-3 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t({ zh: "注册", en: "Create" })}
          </button>

          <div className="text-center mt-6 text-sm text-gray-400">
            {t({ zh: "已有账号？", en: "Already have one?" })} <Link to="/login" className="text-white hover:underline">{t({ zh: "立即登录", en: "Sign in" })}</Link>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, error, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors"
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
