import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, AlertTriangle, HelpCircle, Copy, RotateCcw } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

const searchSchema = z.object({
  title: z.string().default(""),
  status: z.enum(["success", "fake", "unknown"]).default("unknown"),
});

export const Route = createFileRoute("/result")({
  component: ResultPage,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Result — GhostCite" },
      { name: "description", content: "GhostCite verification result." },
    ],
  }),
});

function fmt(d: Date) {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function ResultPage() {
  const { title, status } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [time] = useState(() => fmt(new Date()));
  const [copied, setCopied] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { retryRef.current?.focus(); }, []);

  const META = {
    success: {
      icon: CheckCircle2,
      color: "text-emerald-300",
      chip: t({ zh: "已通过", en: "Verified" }),
      headline: t({ zh: "找到了。这篇论文真实存在。", en: "Found. This paper is real." }),
      desc: t({ zh: "在学术数据库中检索到了可信记录。", en: "We found a trustworthy record across academic databases." }),
    },
    fake: {
      icon: AlertTriangle,
      color: "text-rose-300",
      chip: t({ zh: "疑似虚假", en: "Likely fake" }),
      headline: t({ zh: "未找到来源。这条引用可能不存在。", en: "No source found. This citation may not exist." }),
      desc: t({ zh: "在主流学术数据库中未检索到有效记录。", en: "No valid record was found across leading academic databases." }),
    },
    unknown: {
      icon: HelpCircle,
      color: "text-amber-300",
      chip: t({ zh: "无法判断", en: "Inconclusive" }),
      headline: t({ zh: "暂时无法判断。请稍后再试。", en: "Couldn't decide yet. Try again in a moment." }),
      desc: t({ zh: "数据来源覆盖度或置信度不足。", en: "Coverage or confidence wasn't enough this time." }),
    },
  } as const;

  const meta = META[status as keyof typeof META];
  const Icon = meta.icon;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`【${meta.chip}】${title}\n${t({ zh: "时间", en: "Time" })}: ${time}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="liquid-glass rounded-3xl p-8 sm:p-10 animate-blur-fade-up">
            <div className={`flex items-center gap-3 mb-6 ${meta.color}`}>
              <Icon className="w-7 h-7" />
              <span className="text-sm uppercase tracking-widest">{meta.chip}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-normal mb-3 break-words" style={{ letterSpacing: "-0.03em" }}>
              {meta.headline}
            </h1>
            <p className="text-sm text-gray-400 mb-8">{meta.desc}</p>

            <div className="liquid-glass rounded-2xl p-5 mb-5">
              <div className="text-xs text-gray-400 mb-2">{t({ zh: "你输入的标题", en: "Your input" })}</div>
              <div className="text-base sm:text-lg break-words whitespace-pre-wrap">{title || t({ zh: "（空）", en: "(empty)" })}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <InfoTile label={t({ zh: "检测时间", en: "Time" })} value={time} />
              <InfoTile
                label={t({ zh: "数据来源", en: "Sources" })}
                value={t({
                  zh: "核心学术数据库、期刊索引、开放获取库",
                  en: "Core academic databases, journal indexes, open-access archives",
                })}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                ref={retryRef}
                onClick={() => navigate({ to: "/" })}
                className="flex items-center gap-2 bg-white text-black rounded-full font-medium px-6 py-2.5 hover:bg-gray-200 transition-colors"
              >
                <RotateCcw size={16} /> {t({ zh: "重新检测", en: "Verify another" })}
              </button>
              <button
                onClick={copy}
                className="flex items-center gap-2 liquid-glass rounded-full px-6 py-2.5 hover:bg-white/5 transition-colors"
              >
                <Copy size={16} /> {copied ? t({ zh: "已复制", en: "Copied" }) : t({ zh: "复制结果", en: "Copy result" })}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="liquid-glass rounded-2xl p-4">
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}
