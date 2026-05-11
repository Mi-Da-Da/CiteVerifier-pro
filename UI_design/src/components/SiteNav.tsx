import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, ChevronDown, User } from "lucide-react";
import { useT, LanguageToggle } from "@/lib/i18n";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useT();

  const navLinks = [
    { label: t({ zh: "首页", en: "Home" }), to: "/" as const },
    { label: t({ zh: "英文文献", en: "English" }), to: "/english-literature" as const },
    { label: t({ zh: "中文文献", en: "Chinese" }), to: "/chinese-literature" as const },
  ];

  const moreLinks = [
    { label: t({ zh: "关于我们", en: "About" }), to: "/more" as const },
    { label: t({ zh: "联系方式", en: "Contact" }), to: "/more" as const },
    { label: t({ zh: "常见问题", en: "FAQ" }), to: "/more" as const },
    { label: t({ zh: "更新日志", en: "Changelog" }), to: "/more" as const },
    { label: t({ zh: "API 文档", en: "API Docs" }), to: "/more" as const },
    { label: t({ zh: "用户反馈", en: "Feedback" }), to: "/more" as const },
  ];

  const moreLabel = t({ zh: "更多", en: "More" });
  const loginLabel = t({ zh: "登录", en: "Sign in" });

  return (
    <>
      <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-6">
        <Link
          to="/"
          className="animate-blur-fade-up h-8 md:h-10 flex items-center text-xl md:text-2xl font-semibold tracking-[-0.04em]"
          style={{ animationDelay: "0ms" }}
        >
          GhostCite
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link, i) => (
            <Link
              key={link.to + link.label}
              to={link.to}
              className="animate-blur-fade-up text-sm hover:text-gray-300 transition-colors"
              activeProps={{ className: "text-white" }}
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <button
              className="animate-blur-fade-up text-sm hover:text-gray-300 transition-colors flex items-center gap-1"
              style={{ animationDelay: "250ms" }}
            >
              {moreLabel} <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className={`absolute top-full right-0 mt-2 w-44 liquid-glass rounded-2xl p-2 transition-all duration-300 ${
                moreOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {moreLinks.map(m => (
                <Link
                  key={m.label}
                  to={m.to}
                  className="block px-3 py-2 text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="animate-blur-fade-up" style={{ animationDelay: "320ms" }}>
            <LanguageToggle />
          </div>
          <Link
            to="/login"
            className="animate-blur-fade-up hidden sm:flex items-center gap-2 liquid-glass rounded-full px-5 py-2 text-sm"
            style={{ animationDelay: "350ms" }}
          >
            <User size={16} />
            {loginLabel}
          </Link>
          <button
            onClick={() => setOpen(o => !o)}
            className="animate-blur-fade-up lg:hidden flex items-center justify-center liquid-glass w-10 h-10 rounded-full relative"
            style={{ animationDelay: "350ms" }}
            aria-label="Menu"
          >
            <Menu size={18} className={`absolute transition-all duration-500 ${open ? "rotate-180 opacity-0" : "opacity-100"}`} />
            <X size={18} className={`absolute transition-all duration-500 ${open ? "opacity-100" : "-rotate-180 opacity-0"}`} />
          </button>
        </div>
      </nav>

      <div
        className={`lg:hidden absolute top-[72px] left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-b border-gray-800 shadow-2xl transition-all duration-500 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col p-4 gap-1">
          {[...navLinks, { label: moreLabel, to: "/more" as const }].map((link, i) => (
            <Link
              key={`${link.to}-${i}`}
              to={link.to}
              onClick={() => setOpen(false)}
              className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="sm:hidden mt-2 pt-4 border-t border-gray-800 py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2"
          >
            <User size={16} /> {loginLabel}
          </Link>
        </div>
      </div>
    </>
  );
}
