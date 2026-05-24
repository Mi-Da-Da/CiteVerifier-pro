import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";
import { apiClient, SearchResult } from "@/lib/api-client";

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
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const stages = [
    { until: 25, text: t({ zh: "检索学术数据库", en: "Searching academic databases" }) },
    { until: 50, text: t({ zh: "比对学术索引", en: "Matching against indexes" }) },
    { until: 75, text: t({ zh: "分析引用真实性", en: "Analyzing authenticity" }) },
    { until: 100, text: t({ zh: "生成检测报告", en: "Compiling report" }) },
  ];

  useEffect(() => {
    if (!title) {
      navigate({ to: "/" });
      return;
    }

    let isMounted = true;
    let raf = 0;
    
    const searchAndAnimate = async () => {
      try {
        const animationStart = Date.now();
        const duration = 2500;

        // 开始动画
        const animate = () => {
          const p = Math.min(90, ((Date.now() - animationStart) / duration) * 100);
          if (isMounted) {
            setProgress(p);
          }
          if (p < 90 && isMounted) {
            raf = requestAnimationFrame(animate);
          }
        };
        animate();

        // 同时调用后端API
        const result = await apiClient.searchTitle({ title });
        if (isMounted) {
          setSearchResult(result);
        }

        // 完成动画
        const finishAnim = () => {
          const p = Math.min(100, ((Date.now() - animationStart) / duration) * 100);
          if (isMounted) {
            setProgress(p);
          }
          if (p < 100 && isMounted) {
            raf = requestAnimationFrame(finishAnim);
          } else if (isMounted) {
            const status = result.found ? "success" : "fake";
            setTimeout(() => {
              navigate({ 
                to: "/result", 
                search: { 
                  title, 
                  status,
                  dblp_title: result.dblp_title || "",
                  dblp_id: result.dblp_id?.toString() || "",
                  year: result.year?.toString() || "",
                  venue: result.venue || "",
                  similarity: result.dblp_title_similarity?.toString() || ""
                } 
              });
            }, 300);
          }
        };
        finishAnim();
      } catch (error) {
        if (isMounted) {
          setFailed(true);
        }
      }
    };

    searchAndAnimate();

    return () => {
      isMounted = false;
      cancelAnimationFrame(raf);
    };
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

              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden mb-3 relative">
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
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          done ? "bg-white text-black" : active ? "bg-white/10 text-white" : "bg-white/5 text-gray-500"
                        }`}
                      >
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
