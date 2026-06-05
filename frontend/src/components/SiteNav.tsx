import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, User, ChevronDown, HelpCircle, LogOut, Clock } from "lucide-react";
import { useT, LanguageToggle } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { email, logout } = useAuth();

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

  const searchOptions = [
    { label: t({ zh: "简单检索", en: "Simple Search" }), to: "/simple-search" as const },
    { label: t({ zh: "批量检索", en: "Batch Search" }), to: "/advanced-search" as const },
    { label: t({ zh: "历史记录", en: "History" }), to: "/history" as const, icon: Clock },
  ];

  const homeLabel = t({ zh: "首页", en: "Home" });
  const loginLabel = t({ zh: "登录", en: "Sign in" });
  const helpLabel = t({ zh: "帮助", en: "Help" });
  const searchLabel = t({ zh: "检索", en: "Search" });
  const moreLabel = t({ zh: "更多", en: "More" });
  const logoutLabel = t({ zh: "退出登录", en: "Sign out" });

  const pillCls = "liquid-glass rounded-full px-3.5 h-9 text-xs font-medium tracking-wide hover:bg-white/10 transition-colors flex items-center gap-1.5";

  return (
    <>
      <nav dir="ltr" className="relative z-50 h-[72px] md:h-[88px] px-4 sm:px-6 md:px-12">
        <Link
          to="/"
          className="absolute left-4 sm:left-6 md:left-12 top-1/2 -translate-y-1/2 h-8 md:h-10 flex items-center text-xl md:text-2xl font-semibold tracking-[-0.04em]"
        >
          GhostCite
        </Link>

        {/* 桌面端中间导航 */}
        <div dir="ltr" className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 h-9">
          <Link
            to="/"
            className="text-sm hover:text-gray-300 transition-colors flex items-center h-9 leading-none"
            activeProps={{ className: "text-white" }}
          >
            {homeLabel}
          </Link>

          <div ref={searchRef} className="relative flex items-center h-9">
            <button
              onClick={() => setSearchOpen(o => !o)}
              className="text-sm hover:text-gray-300 transition-colors flex items-center gap-1 h-9 leading-none"
            >
              {searchLabel}
              <ChevronDown size={13} className={`transition-transform ${searchOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className={`!absolute left-0 top-full mt-3 w-44 liquid-glass rounded-2xl p-1.5 transition-all duration-200 ${
                searchOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              {searchOptions.map(opt => (
                <Link
                  key={opt.to}
                  to={opt.to}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  {opt.icon && <opt.icon size={13} className="text-gray-400" />}
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center h-9">
            <LanguageToggle />
          </div>

          <Link
            to="/more"
            className="text-sm hover:text-gray-300 transition-colors flex items-center h-9 leading-none"
            activeProps={{ className: "text-white" }}
          >
            {moreLabel}
          </Link>
        </div>

        {/* 桌面端右侧按钮 */}
        <div dir="ltr" className="absolute right-4 sm:right-6 md:right-12 top-1/2 -translate-y-1/2 flex items-center gap-2 h-9">
          <Link to="/more" className={`hidden sm:flex ${pillCls}`}>
            <HelpCircle size={13} />
            {helpLabel}
          </Link>
          {email ? (
            <div ref={accountRef} className="relative hidden sm:block">
              <button onClick={() => setAccountOpen(o => !o)} className={pillCls} aria-label="Account">
                <User size={13} />
                <span className="max-w-[180px] truncate">{email}</span>
                <ChevronDown size={12} className={`transition-transform ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`!absolute right-0 top-full mt-2 w-48 liquid-glass rounded-2xl p-1.5 z-50 transition-all duration-200 ${
                  accountOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                <div className="px-3 py-2 text-[11px] text-gray-400 truncate border-b border-white/10 mb-1">{email}</div>
                <Link
                  to="/history"
                  onClick={() => setAccountOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Clock size={13} /> {t({ zh: "历史记录", en: "History" })}
                </Link>
                <button
                  onClick={() => { logout(); setAccountOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-colors"
                >
                  <LogOut size={13} /> {logoutLabel}
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className={`hidden sm:flex ${pillCls}`}>
              <User size={13} />
              {loginLabel}
            </Link>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="md:hidden flex items-center justify-center liquid-glass w-9 h-9 rounded-full relative"
            aria-label="Menu"
          >
            <Menu size={18} className={`absolute transition-all duration-500 ${open ? "rotate-180 opacity-0" : "opacity-100"}`} />
            <X size={18} className={`absolute transition-all duration-500 ${open ? "opacity-100" : "-rotate-180 opacity-0"}`} />
          </button>
        </div>
      </nav>

      {/* 移动端菜单 */}
      <div
        dir="ltr"
        className={`md:hidden absolute top-[72px] left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-b border-gray-800 shadow-2xl transition-all duration-500 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col p-4 gap-1">
          <Link to="/" onClick={() => setOpen(false)} className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all">
            {homeLabel}
          </Link>
          {searchOptions.map(opt => (
            <Link
              key={opt.to}
              to={opt.to}
              onClick={() => setOpen(false)}
              className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all flex items-center gap-2"
            >
              {opt.icon && <opt.icon size={15} className="text-gray-400" />}
              {opt.label}
            </Link>
          ))}
          <Link to="/more" onClick={() => setOpen(false)} className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-all">
            {moreLabel}
          </Link>
          <Link to="/more" onClick={() => setOpen(false)} className="py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2">
            <HelpCircle size={16} /> {helpLabel}
          </Link>
          {email ? (
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="sm:hidden mt-2 pt-4 border-t border-gray-800 py-3 px-3 rounded-lg hover:bg-gray-800/50 flex items-center gap-2 text-left"
            >
              <LogOut size={16} /> <span className="truncate">{email}</span>
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
