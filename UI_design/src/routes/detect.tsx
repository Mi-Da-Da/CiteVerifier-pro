import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

const searchSchema = z.object({ title: z.string().default("") });

export const Route = createFileRoute("/detect")({
  component: DetectPage,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Verifying — GhostCite" },
      { name: "description", content: "GhostCite is verifying your citation." },
    ],
  }),
});

function DetectPage() {
  const { title } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const stages = [
    { until: 25, text: t({ zh: "检索学术数据库。", en: "Searching academic databases." }) },
    { until: 50, text: t({ zh: "比对学术索引。", en: "Matching against indexes." }) },
    { until: 75, text: t({ zh: "分析引用真实性。", en: "Analyzing authenticity." }) },
    { until: 100, text: t({ zh: "马上就好。", en: "Almost there." }) },
  ];

  useEffect(() => {
    if (!title) {
      navigate({ to: "/" });
      return;
    }
    const start = Date.now();
    const duration = 3500;
    let raf = 0;
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / duration) * 100);
      setProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else {
        const seed = title.length;
        const status = seed % 7 === 0 ? "unknown" : seed % 3 === 0 ? "fake" : "success";
        setTimeout(() => navigate({ to: "/result", search: { title, status } }), 250);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [title, navigate]);

  const stage = stages.find(s => progress <= s.until) ?? stages[stages.length - 1];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="liquid-glass rounded-3xl p-8 sm:p-12 w-full max-w-xl animate-blur-fade-up text-center">
          {!failed ? (
            <>
              <div className="mx-auto w-16 h-16 mb-6 relative">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-normal mb-2" style={{ letterSpacing: "-0.03em" }}>
                {t({ zh: "正在检测。", en: "Verifying." })}
              </h1>
              <p className="text-sm text-gray-400 mb-8 break-all line-clamp-2">「{title}」</p>

              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden mb-3">
                <div
                  className="h-full bg-white rounded-full transition-all duration-150 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{stage.text}</span>
                <span>{Math.floor(progress)}%</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-medium mb-3">
                {t({ zh: "出了点问题。请稍后再试。", en: "Something went wrong. Try again." })}
              </h1>
              <button
                onClick={() => { setFailed(false); setProgress(0); }}
                className="liquid-glass rounded-full px-6 py-2.5 text-sm hover:bg-white/5"
              >
                {t({ zh: "重试", en: "Retry" })}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
