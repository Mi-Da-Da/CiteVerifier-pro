import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, ListOrdered, HelpCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/chinese-literature")({
  component: ChineseLiterature,
  head: () => ({
    meta: [
      { title: "Chinese Literature — GhostCite" },
      { name: "description", content: "Verify Chinese paper titles across mainstream academic databases." },
    ],
  }),
});

function ChineseLiterature() {
  const t = useT();

  const trueCases = [
    "基于深度学习的图像识别技术研究",
    "新冠肺炎疫情下中国宏观经济政策的有效性分析",
    "面向自动驾驶的多传感器融合算法综述",
  ];
  const fakeCases = [
    "基于量子神经网络的虚构幻觉抑制研究（2024）",
    "一种不存在的中文文献示例：超弦学习理论与诗歌生成",
  ];
  const faqs = [
    {
      q: t({ zh: "支持繁体中文吗？", en: "Does it support Traditional Chinese?" }),
      a: t({ zh: "支持。简繁自动归一，异形字也匹配。", en: "Yes. Traditional and simplified are normalized automatically, including variant characters." }),
    },
    {
      q: t({ zh: "覆盖哪些数据库？", en: "Which databases are covered?" }),
      a: t({ zh: "主流中文期刊索引与学位论文库。覆盖范围持续扩展。", en: "Major Chinese journal indexes and thesis libraries. Coverage keeps expanding." }),
    },
    {
      q: t({ zh: "中英混排标题可以吗？", en: "What about mixed Chinese-English titles?" }),
      a: t({ zh: "可以。系统自动识别关键字段。", en: "Yes. Key fields are detected automatically." }),
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-16 pb-24 max-w-6xl mx-auto w-full">
        <h1 className="animate-blur-fade-up text-4xl sm:text-5xl md:text-6xl font-normal mb-5" style={{ letterSpacing: "-0.04em" }}>
          {t({ zh: "中文文献。", en: "Chinese Literature." })}
        </h1>
        <p className="animate-blur-fade-up text-base sm:text-lg text-gray-300 max-w-2xl mb-12" style={{ animationDelay: "100ms" }}>
          {t({
            zh: "为中文学术语境而调。覆盖主流期刊、学位论文与开放获取库。",
            en: "Tuned for Chinese academic writing. Across major journals, theses and open-access archives.",
          })}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-xl font-medium mb-3">{t({ zh: "它能做什么。", en: "What it does." })}</h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t({
                zh: "多源比对，加上语义匹配。判定标题是否真实存在。从学位论文到 AI 写作校验，皆可使用。",
                en: "Multi-source matching, paired with semantic understanding. It tells you if a title truly exists — from theses to AI-assisted writing.",
              })}
            </p>
          </div>
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2"><ListOrdered size={20} /> {t({ zh: "怎么用。", en: "How to use it." })}</h2>
            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
              <li>{t({ zh: "在首页输入框粘贴标题。", en: "Paste a title on the homepage." })}</li>
              <li>{t({ zh: "点击「开始检测」或按下回车。", en: "Click Verify, or press Enter." })}</li>
              <li>{t({ zh: "几秒后，结果出现。", en: "Results appear in seconds." })}</li>
            </ol>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2 text-emerald-300"><CheckCircle2 size={18} /> {t({ zh: "真实示例", en: "Real" })}</h2>
            <ul className="space-y-2 text-sm text-gray-200">
              {trueCases.map(t2 => <li key={t2} className="border-b border-white/5 pb-2 last:border-0">{t2}</li>)}
            </ul>
          </div>
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2 text-rose-300"><XCircle size={18} /> {t({ zh: "虚假示例", en: "Fake" })}</h2>
            <ul className="space-y-2 text-sm text-gray-200">
              {fakeCases.map(t2 => <li key={t2} className="border-b border-white/5 pb-2 last:border-0">{t2}</li>)}
            </ul>
          </div>
        </div>

        <div className="liquid-glass rounded-2xl p-6">
          <h2 className="text-xl font-medium mb-4 flex items-center gap-2"><HelpCircle size={20} /> {t({ zh: "常见问题", en: "Questions" })}</h2>
          <div className="space-y-4">
            {faqs.map(f => (
              <div key={f.q} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                <div className="font-medium mb-1">{f.q}</div>
                <div className="text-sm text-gray-400">{f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link to="/" className="liquid-glass rounded-full px-8 py-3 text-sm hover:bg-white/5 transition-colors">
            {t({ zh: "返回首页检测", en: "Back to verify" })}
          </Link>
        </div>
      </main>
    </div>
  );
}
