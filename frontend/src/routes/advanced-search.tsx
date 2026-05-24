import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/advanced-search")({
  component: BatchSearchPage,
  head: () => ({
    meta: [
      { title: "Batch Search — GhostCite" },
      { name: "description", content: "Verify many citations at once by DOI, patent number, or SRID." },
    ],
  }),
});

type TabKey = "doi" | "patent_pub" | "patent_app" | "srid";

function BatchSearchPage() {
  const t = useT();
  const navigate = useNavigate();

  const tabs: { key: TabKey; label: string; placeholder: string }[] = [
    {
      key: "doi",
      label: t({ zh: "文献DOI", en: "DOI" }),
      placeholder: t({
        zh: "输入DOI，例如：10.1016/j.scib.2025.04.030；多个DOI之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。",
        en: "Enter DOIs, e.g. 10.1016/j.scib.2025.04.030. Separate with newline, comma, semicolon. Up to 1000 per batch.",
      }),
    },
    {
      key: "patent_pub",
      label: t({ zh: "专利公开号", en: "Patent Publication No." }),
      placeholder: t({
        zh: "输入专利公开号，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。",
        en: "Enter patent publication numbers. Up to 1000 per batch.",
      }),
    },
    {
      key: "patent_app",
      label: t({ zh: "专利申请号", en: "Patent Application No." }),
      placeholder: t({
        zh: "输入专利申请号，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。",
        en: "Enter patent application numbers. Up to 1000 per batch.",
      }),
    },
    {
      key: "srid",
      label: "SRID",
      placeholder: t({
        zh: "输入SRID，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。",
        en: "Enter SRIDs. Up to 1000 per batch.",
      }),
    },
  ];

  const [tab, setTab] = useState<TabKey>("doi");
  const [value, setValue] = useState("");

  const active = tabs.find(t => t.key === tab)!;

  const submit = () => {
    const first = value
      .split(/[\n,，;；、]/)
      .map(s => s.trim())
      .find(Boolean);
    if (first) navigate({ to: "/detect", search: { title: first } });
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      <SiteBackdrop />
      <SiteNav />

      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-16 pb-24">
        <div className="max-w-5xl mx-auto">
          <h1
            className="animate-blur-fade-up text-4xl md:text-5xl font-normal mb-3 text-center"
            style={{ letterSpacing: "-0.04em" }}
          >
            {t({ zh: "批量检索", en: "Batch search" })}
          </h1>
          <p
            className="animate-blur-fade-up text-sm md:text-base text-gray-400 mb-10 text-center"
            style={{ animationDelay: "100ms" }}
          >
            {t({
              zh: "一次粘贴。批量核验。",
              en: "Paste once. Verify in bulk.",
            })}
          </p>

          <div
            className="animate-blur-fade-up liquid-glass rounded-3xl p-5 md:p-8"
            style={{ animationDelay: "200ms" }}
          >
            <div className="flex flex-wrap gap-1 border-b border-white/10 mb-5">
              {tabs.map(tb => {
                const activeTab = tb.key === tab;
                return (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`relative px-4 md:px-5 py-3 text-sm transition-colors ${
                      activeTab ? "text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {tb.label}
                    {activeTab && (
                      <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={active.placeholder}
              className="w-full min-h-[260px] md:min-h-[320px] bg-transparent outline-none resize-y text-sm leading-relaxed placeholder:text-gray-500 p-3"
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-200 liquid-glass rounded-full px-4 py-2 hover:bg-white/10 transition-colors"
                >
                  <FileSpreadsheet size={14} /> {t({ zh: "导入Excel", en: "Import Excel" })}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors px-2"
                >
                  <FileText size={14} /> {t({ zh: "示例模板", en: "Template" })}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  className="liquid-glass rounded-full px-6 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  {t({ zh: "匹配", en: "Match" })}
                </button>
                <button
                  onClick={submit}
                  className="bg-white text-black rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t({ zh: "直接检索", en: "Search" })}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
