import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, ListOrdered, HelpCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/english-literature")({
  component: EnglishLiterature,
  head: () => ({
    meta: [
      { title: "English Literature — CiteVerifier" },
      { name: "description", content: "Verify English paper titles across leading academic indexes." },
    ],
  }),
});

function EnglishLiterature() {
  const t = useT();

  const trueCases = [
    "Attention Is All You Need",
    "Deep Residual Learning for Image Recognition",
    "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
  ];
  const fakeCases = [
    "Quantum Neural Synthesis for Generative Hallucination Suppression (2023)",
    "GhostBench: A Benchmark That Does Not Exist",
  ];
  const faqs = [
    {
      q: t({ zh: "支持哪些英文标题？", en: "What kinds of titles are supported?" }),
      a: t({ zh: "纯英文，以及英文为主的混排。关键字段自动识别。", en: "Pure English titles, and English-led mixed titles. Key fields are detected automatically." }),
    },
    {
      q: t({ zh: "覆盖哪些英文数据库？", en: "Which databases are covered?" }),
      a: t({ zh: "核心期刊索引、会议库与开放获取库。范围持续扩展。", en: "Leading journal indexes, conference libraries and open-access archives. Coverage keeps growing." }),
    },
    {
      q: t({ zh: "标题中的特殊字符可以识别吗？", en: "Are special characters handled?" }),
      a: t({ zh: "可以。冒号、连字符、希腊字母等学术符号皆支持。", en: "Yes. Colons, hyphens, Greek letters and common scholarly marks are all supported." }),
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-16 pb-24 max-w-6xl mx-auto w-full">
        <h1 className="animate-blur-fade-up text-4xl sm:text-5xl md:text-6xl font-normal mb-5" style={{ letterSpacing: "-0.04em" }}>
          {t({ zh: "英文文献。", en: "English Literature." })}
        </h1>
        <p className="animate-blur-fade-up text-base sm:text-lg text-gray-300 max-w-2xl mb-12" style={{ animationDelay: "100ms" }}>
          {t({
            zh: "面向英文学术写作。覆盖核心索引与开放获取库。",
            en: "Built for English academic writing. Across leading indexes and open-access archives.",
          })}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-xl font-medium mb-3">{t({ zh: "它能做什么。", en: "What it does." })}</h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t({
                zh: "多源比对，结合语义匹配。判定一篇英文标题是否真实存在。从综述写作到投稿前自检，都适用。",
                en: "Multi-source matching with semantic understanding. Confirms whether an English title points to a real paper — from literature reviews to pre-submission checks.",
              })}
            </p>
          </div>
          <div className="liquid-glass rounded-2xl p-6">
            <h2 className="text-xl font-medium mb-3 flex items-center gap-2"><ListOrdered size={20} /> {t({ zh: "怎么用。", en: "How to use it." })}</h2>
            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
              <li>{t({ zh: "在首页输入框粘贴英文标题。", en: "Paste an English title on the homepage." })}</li>
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
