import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type Lang = "zh" | "en";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "ghostcite.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const toggle = useCallback(() => setLang(lang === "zh" ? "en" : "zh"), [lang, setLang]);

  return <LangCtx.Provider value={{ lang, setLang, toggle }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

/**
 * Translation hook. Pass strings as { zh, en } and get the active one.
 * Usage: const t = useT(); t({ zh: "你好", en: "Hello" })
 */
export function useT() {
  const { lang } = useLang();
  return useCallback(<T,>(pair: { zh: T; en: T }): T => pair[lang], [lang]);
}

/** Pill-style language switcher button. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      className={`liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide hover:bg-white/10 transition-colors flex items-center gap-1.5 ${className}`}
      aria-label="Toggle language"
    >
      <span className={lang === "zh" ? "text-white" : "text-gray-500"}>中</span>
      <span className="text-gray-600">/</span>
      <span className={lang === "en" ? "text-white" : "text-gray-500"}>EN</span>
    </button>
  );
}
