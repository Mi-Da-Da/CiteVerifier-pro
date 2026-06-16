import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";
import { apiClient } from "@/lib/api-client";

const searchSchema = z.object({ title: z.string().default(""), lang: z.enum(["zh", "en"]).default("en") });

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
  const { title, lang } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const searchedRef = useRef(false);
  const cancelledRef = useRef(false);

  const stages = [
    { until: 30, text: t({ zh: "检索学术数据库", en: "Searching academic databases" }) },
    { until: 60, text: t({ zh: "比对学术索引", en: "Matching against indexes" }) },
    { until: 85, text: t({ zh: "分析引用真实性", en: "Analyzing authenticity" }) },
    { until: 100, text: t({ zh: "生成检测报告", en: "Compiling report" }) },
  ];

  useEffect(() => {
    if (!title) { navigate({ to: "/" }); return; }

    cancelledRef.current = false;
    let raf = 0;
    const startTime = Date.now();

    const animateTo85 = () => {
      if (cancelledRef.current) return;
      const elapsed = Date.now() - startTime;
      const p = Math.min(85, (elapsed / 4000) * 85);
      setProgress(p);
      if (p < 85) raf = requestAnimationFrame(animateTo85);
    };
    raf = requestAnimationFrame(animateTo85);

    if (!searchedRef.current) {
      searchedRef.current = true;

      apiClient.searchTitle({ title, lang })
        .then(data => {
          if (cancelledRef.current) return;

          cancelAnimationFrame(raf);
          const finish = () => {
            if (cancelledRef.current) return;
            setProgress(prev => {
              if (prev >= 100) return 100;
              const next = Math.min(100, prev + 2);
              if (next < 100) raf = requestAnimationFrame(finish);
              return next;
            });
          };
          raf = requestAnimationFrame(finish);

          setTimeout(() => {
            if (cancelledRef.current) return;
            const found = data.found === true;
            const sim = data.dblp_title_similarity ?? null;
            let status: "success" | "fake" | "unknown";
            if (found && sim !== null && sim >= 0.8) status = "success";
            else if (found) status = "unknown";
            else status = "fake";

            navigate({
              to: "/result",
              search: {
                title,
                status,
                matchedTitle: data.dblp_title ?? "",
                similarity: sim !== null ? String(Math.round(sim * 100)) : "",
              },
            });
          }, 600);
        })
        .catch(() => { if (!cancelledRef.current) setFailed(true); });
    }

    return () => { cancelledRef.current = true; cancelAnimationFrame(raf); };
  }, [title, lang, navigate]);

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
                  className="h-full bg-gradient-to-r from-white/70 to-white rounded-full transition-all duration-150 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-6">
                <span>{stage.text}</span>
                <span className="tabular-nums">{Math.floor(progress)}%</span>
              </div>

              <ul className="text-left space-y-2.5">
                {stages.map((s, i) => {
                  const prevUntil = i === 0 ? 0 : stages[i - 1].until;
                  const done = progress >= s.until;
                  const active = !done && progress >= prevUntil;
                  return (
                    <li key={s.text} className="flex items-center gap-3 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        done ? "bg-white text-black" : active ? "bg-white/10 text-white" : "bg-white/5 text-gray-500"
                      }`}>
                        {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="w-1 h-1 rounded-full bg-current" />}
                      </span>
                      <span className={done ? "text-white" : active ? "text-gray-200" : "text-gray-500"}>{s.text}</span>
                    </li>
                  );
                })}
              </ul>
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
