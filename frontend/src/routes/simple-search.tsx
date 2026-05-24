import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/simple-search")({
  component: SimpleSearchPage,
  head: () => ({
    meta: [
      { title: "简单检索 — GhostCite" },
      { name: "description", content: "Verify a single citation in seconds." },
    ],
  }),
});

function SimpleSearchPage() {
  const navigate = useNavigate();
  const t = useT();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!title.trim()) {
      setError(t({ zh: "请输入论文标题。", en: "Enter a paper title." }));
      return;
    }
    navigate({ to: "/detect", search: { title: title.trim() } });
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />

      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-12 md:pt-24 pb-24">
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
          <h1
            className="animate-blur-fade-up text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal mb-12"
            style={{ animationDelay: "200ms", letterSpacing: "-0.04em" }}
          >
            {t({ zh: "简单检索", en: "Simple Search" })}
          </h1>

          <div
            className="animate-blur-fade-up liquid-glass rounded-3xl p-3 md:p-4 flex flex-col sm:flex-row gap-3 w-full max-w-4xl"
            style={{ animationDelay: "400ms" }}
          >
            <div className="flex items-center gap-3 flex-1 px-5">
              <Search size={22} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={t({ zh: "粘贴或输入论文标题…", en: "Paste or type a paper title…" })}
                className="bg-transparent outline-none w-full py-5 md:py-6 text-base md:text-lg placeholder:text-gray-500"
              />
            </div>
            <button
              onClick={submit}
              className="bg-white text-black rounded-2xl font-medium px-8 md:px-10 py-4 md:py-5 hover:bg-gray-200 transition-colors text-base md:text-lg"
            >
              {t({ zh: "开始检测", en: "Verify" })}
            </button>
          </div>
          {error && <p className="animate-blur-fade-up mt-4 text-sm text-red-400">{error}</p>}

          <p
            className="animate-blur-fade-up mt-10 text-sm text-gray-400 max-w-xl"
            style={{ animationDelay: "600ms" }}
          >
            {t({
              zh: "三重核验：数据库比对 · 谷歌学术 · AI 大模型。平均三秒给出答案。",
              en: "Three layers of verification — databases, Google Scholar, frontier AI — in about three seconds.",
            })}
          </p>
        </div>
      </section>
    </div>
  );
}