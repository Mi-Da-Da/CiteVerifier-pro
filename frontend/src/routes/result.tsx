import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, AlertTriangle, HelpCircle, Copy, RotateCcw } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

const searchSchema = z.object({
  title: z.string().default(""),
  status: z.enum(["verified", "suspicious", "unverifiable", "search_error"]).default("unverifiable"),
  matchedTitle: z.string().default(""),
  similarity: z.string().default(""),
  lang: z.enum(["zh", "en"]).default("en"),
});

export const Route = createFileRoute("/result")({
  component: ResultPage,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Result — CiteVerifier" },
      { name: "description", content: "CiteVerifier verification result." },
    ],
  }),
});

function fmt(d: Date) {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function ResultPage() {
  const { title, status, matchedTitle, similarity, lang } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [time] = useState(() => fmt(new Date()));
  const [copied, setCopied] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);
  const sourceName = lang === "zh" ? "百度学术" : "DBLP";
  const sourceNameEn = lang === "zh" ? "Baidu Scholar" : "DBLP";

  const simNum = similarity ? parseInt(similarity, 10) : null;
  const simColor =
    simNum === null ? "text-gray-400"
    : simNum >= 80 ? "text-emerald-300"
    : simNum >= 50 ? "text-amber-300"
    : "text-rose-300";

  const META = {
    verified: {
      icon: CheckCircle2,
      color: "text-emerald-300",
      chip: t({ zh: "已通过", en: "Verified" }),
      headline: t({ zh: "找到了。这篇论文真实存在。", en: "Found. This paper is real." }),
      desc: t({ zh: `在${sourceName}中检索到了可信记录。`, en: `A trustworthy record was found in ${sourceNameEn}.` }),
    },
    suspicious: {
      icon: AlertTriangle,
      color: "text-rose-300",
      chip: t({ zh: "疑似异常", en: "Suspicious" }),
      headline: t({ zh: "找到近似记录，但相似度不足，建议人工核查。", en: "A similar record was found, but its similarity is insufficient." }),
      desc: t({ zh: `${sourceName}中存在候选文献，但尚不能确认为同一篇。`, en: `A candidate exists in ${sourceNameEn}, but it cannot be confirmed as the same paper.` }),
    },
    unverifiable: {
      icon: HelpCircle,
      color: "text-gray-300",
      chip: t({ zh: "无法验证", en: "Unverifiable" }),
      headline: t({ zh: "没有找到可用于判断的候选文献。", en: "No candidate was found to support a determination." }),
      desc: t({ zh: "当前证据不足，不能直接判定该引用为虚假。", en: "There is insufficient evidence to classify this citation as false." }),
    },
    search_error: {
      icon: AlertTriangle,
      color: "text-rose-400",
      chip: t({ zh: "检索异常", en: "Search error" }),
      headline: t({ zh: "检索过程未能正常完成。", en: "The search could not be completed." }),
      desc: t({ zh: "数据库、网络或第三方服务发生异常，请稍后重试。", en: "A database, network, or third-party service error occurred. Please try again." }),
    },
  } as const;

  const meta = META[status as keyof typeof META];
  const Icon = meta.icon;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `【${meta.chip}】${title}\n${t({ zh: "时间", en: "Time" })}: ${time}`
      );
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

            {/* 查询标题 */}
            <div className="liquid-glass rounded-2xl p-5 mb-3">
              <div className="text-xs text-gray-400 mb-2">{t({ zh: "你输入的标题", en: "Your input" })}</div>
              <div className="text-base sm:text-lg break-words">{title || t({ zh: "（空）", en: "(empty)" })}</div>
            </div>

            {/* Source match result */}
            {matchedTitle && (
              <div className="liquid-glass rounded-2xl p-5 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">{t({ zh: `${sourceName}匹配标题`, en: `${sourceNameEn} matched title` })}</div>
                  {simNum !== null && (
                    <span className={`text-sm font-medium tabular-nums ${simColor}`}>
                      {t({ zh: "相似度", en: "Similarity" })} {simNum}%
                    </span>
                  )}
                </div>
                <div className="text-sm break-words">{matchedTitle}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="liquid-glass rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1.5">{t({ zh: "检测时间", en: "Time" })}</div>
                <div className="text-sm">{time}</div>
              </div>
              <div className="liquid-glass rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1.5">{t({ zh: "数据来源", en: "Source" })}</div>
                <div className="text-sm">{sourceName}</div>
              </div>
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
