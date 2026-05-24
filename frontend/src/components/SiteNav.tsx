import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, User, ChevronDown, HelpCircle, LogOut } from "lucide-react";
import { useT, LanguageToggle } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  const navLinks = [
    { label: t({ zh: "首页", en: "Home" }), to: "/" as const },
    { label: t({ zh: "英文文献", en: "English" }), to: "/english-literature" as const },
    { label: t({ zh: "中文文献", en: "Chinese" }), to: "/chinese-literature" as const },
  ];

  const searchOptions = [
    { label: t({ zh: "简单检索", en: "Simple Search" }), to: "/simple-search" as const },
    { label: t({ zh: "批量检索", en: "Batch Search" }), to: "/advanced-search" as const },
  ];

  const loginLabel = t({ zh: "登录", en: "Sign in" });
  const helpLabel = t({ zh: "帮助", en: "Help" });
  const searchLabel = t({ zh: "检索", en: "Search" });
  const moreLabel = t({ zh: "更多", en: "More" });
  const logoutLabel = t({ zh: "退出登录", en: "Sign out" });

  // Shared pill style so login / account / language / help all align in height.
  const pillCls = "liquid-glass rounded-full px-3.5 h-9 text-xs font-medium tracking-wide hover:bg-white/10 transition-colors flex items-center gap-1.5";

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

          <div ref={searchRef} className="relative animate-blur-fade-up" style={{ animationDelay: "250ms" }}>
            <button
              onClick={() => setSearchOpen(o => !o)}
              className="text-sm hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              {searchLabel}
              <ChevronDown size={13} className={`transition-transform ${searchOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className={`absolute left-0 top-full mt-3 w-44 liquid-glass rounded-2xl p-1.5 transition-all duration-200 ${
                searchOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              {searchOptions.map(opt => (
                <Link
                  key={opt.to}
                  to={opt.to}
                  onClick={() => setSearchOpen(false)}
                  className="block px-3 py-2 text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          <Link
            to="/more"
            className="animate-blur-fade-up text-sm hover:text-gray-300 transition-colors"
            activeProps={{ className: "text-white" }}
            style={{ animationDelay: "300ms" }}
          >
            {moreLabel}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div
              ref={accountRef}
              className="animate-blur-fade-up relative hidden sm:block"
              style={{ animationDelay: "320ms" }}
            >
              <button onClick={() => setAccountOpen(o => !o)} className={pillCls} aria-label="Account">
                <User size={13} />
                <span className="max-w-[180px] truncate">{user?.username}</span>
                <ChevronDown size={12} className={`transition-transform ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`absolute right-0 top-full mt-2 w-48 liquid-glass rounded-2xl p-1.5 z-50 transition-all duration-200 ${
                  accountOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                <div className="px-3 py-2 text-[11px] text-gray-400 truncate border-b border-white/10 mb-1">{user?.username}</div>
                <button
                  onClick={() => { logout(); setAccountOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-colors"
                >
                  <LogOut size={13} /> {logoutLabel}
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className={`animate-blur-fade-up hidden sm:flex ${pillCls}`}
              style={{ animationDelay: "320ms" }}
            >
              <User size={13} />
              {loginLabel}
            </Link>
          )}
          <div className="animate-blur-fade-up hidden sm:block" style={{ animationDelay: "340ms" }}>
            <LanguageToggle />
          </div>
          <Link
            to="/more"
            className={`animate-blur-fade-up hidden sm:flex ${pillCls}`}
            style={{ animationDelay: "360ms" }}
          >
            <HelpCircle size={13} />
            {helpLabel}
          </Link>
          <button
            onClick={() => setOpen(o => !o)}
            className="animate-blur-fade-up lg:hidden flex items-center justify-center liquid-glass w-9 h-9 rounded-full relative"
            style={{ animationDelay: "380ms" }}
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
          {navLinks.map((link, i) => (
            <Link
              key={`${link.to}-${i}`}
              to={link.to}
              onClick={() => setOpen(false)}
              className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all"
            >
              {link.label}
            </Link>
          ))}
          {searchOptions.map((opt) => (
            <Link
              key={opt.to}
              to={opt.to}
              onClick={() => setOpen(false)}
              className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all"
            >
              {opt.label}
            </Link>
          ))}
          <Link
            to="/more"
            onClick={() => setOpen(false)}
            className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all"
          >
            {moreLabel}
          </Link>
          <Link
            to="/more"
            onClick={() => setOpen(false)}
            className="py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2"
          >
            <HelpCircle size={16} /> {helpLabel}
          </Link>
          {isAuthenticated ? (
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="sm:hidden mt-2 pt-4 border-t border-gray-800 py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2 text-left"
            >
              <LogOut size={16} /> <span className="truncate">{user?.username}</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="sm:hidden mt-2 pt-4 border-t border-gray-800 py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2"
            >
              <User size={16} /> {loginLabel}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}