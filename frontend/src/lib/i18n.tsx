import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";

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
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = lang === "zh" ? "语言" : "Language";
  const options: { code: string; label: string; available: boolean }[] = [
    { code: "zh", label: "中文", available: true },
    { code: "en", label: "English", available: true },
    { code: "ja", label: "日本語", available: false },
    { code: "ko", label: "한국어", available: false },
    { code: "fr", label: "Français", available: false },
    { code: "es", label: "Español", available: false },
  ];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="liquid-glass rounded-full px-3.5 h-9 text-xs font-medium tracking-wide hover:bg-white/10 transition-colors flex items-center gap-1.5"
        aria-label="Language"
      >
        <Globe size={13} />
        <span>{label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`absolute right-0 top-full mt-2 w-40 liquid-glass rounded-2xl p-1.5 z-50 transition-all duration-200 ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        {options.map(opt => {
          const active = opt.code === lang;
          return (
            <button
              key={opt.code}
              disabled={!opt.available}
              onClick={() => {
                if (!opt.available) return;
                setLang(opt.code as Lang);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                opt.available ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"
              }`}
            >
              <span>{opt.label}</span>
              {active ? <Check size={12} /> : !opt.available ? <span className="text-[10px] text-gray-400">{lang === "zh" ? "即将" : "soon"}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
