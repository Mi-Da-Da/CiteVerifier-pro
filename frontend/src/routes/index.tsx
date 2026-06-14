import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, Sparkles, Database, Languages, Zap,
  Layers, Globe, Brain, ShieldCheck, FileSearch, BookOpen,
  GraduationCap, Newspaper, PenLine, Library,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";
import sceneTheses from "@/assets/scene-theses.png.asset.json";
import sceneJournal from "@/assets/scene-journal.png.asset.json";
import sceneAi from "@/assets/scene-ai.png.asset.json";
import sceneReview from "@/assets/scene-review.png.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GhostCite — Every citation, beyond doubt." },
      { name: "description", content: "GhostCite verifies whether a paper truly exists. In seconds. In Chinese and English." },
    ],
  }),
});

function Index() {
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

  const bigHighlight = {
    icon: Layers,
    title: t({ zh: "三重核验。层层把关。", en: "Three layers. One truth." }),
    desc: t({
      zh: "数据库比对。谷歌学术。AI 大模型。每一条引用，都经得起推敲。",
      en: "Databases. Google Scholar. Frontier AI. Every citation, examined three ways.",
    }),
  };

  const smallHighlights = [
    {
      icon: Zap,
      title: t({ zh: "极速。", en: "Fast." }),
      desc: t({ zh: "平均三秒，给你答案。", en: "Answers in about three seconds." }),
    },
    {
      icon: Sparkles,
      title: t({ zh: "智能。", en: "Intelligent." }),
      desc: t({ zh: "大模型驱动的真实性判断。", en: "Reasoning powered by frontier models." }),
    },
    {
      icon: Languages,
      title: t({ zh: "双语。", en: "Bilingual." }),
      desc: t({ zh: "中文与英文，同等精准。", en: "Chinese and English, equally precise." }),
    },
  ];

  const scenes = [
    {
      icon: GraduationCap,
      image: sceneTheses.url,
      title: t({ zh: "毕业论文。", en: "Theses." }),
      desc: t({
        zh: "上百条参考文献，逐条核验。在答辩前，发现问题，而不是被问到问题。",
        en: "Hundreds of references, every one verified. Catch issues before the defense, not during it.",
      }),
    },
    {
      icon: Newspaper,
      image: sceneJournal.url,
      title: t({ zh: "期刊投稿。", en: "Journal submissions." }),
      desc: t({
        zh: "投稿前的最后一道防线。降低拒稿风险，让评审专注于内容。",
        en: "A final check before you submit. Reduce desk rejections. Let reviewers focus on the work.",
      }),
    },
    {
      icon: PenLine,
      image: sceneAi.url,
      title: t({ zh: "AI 写作。", en: "AI writing." }),
      desc: t({
        zh: "ChatGPT、Claude 偶尔会编造引用。我们识别它们，让 AI 真正可靠。",
        en: "ChatGPT and Claude can invent citations. We catch the ones that don't exist.",
      }),
    },
    {
      icon: Library,
      image: sceneReview.url,
      title: t({ zh: "文献综述。", en: "Literature reviews." }),
      desc: t({
        zh: "成百上千条候选文献，批量核验。把时间留给思考。",
        en: "Thousands of candidates, verified in batch. Spend your time thinking, not checking.",
      }),
    },
  ];

  const footerLinks: { title: string; items: { label: string; to: "/english-literature" | "/chinese-literature" | "/more" }[] }[] = [
    {
      title: t({ zh: "产品", en: "Product" }),
      items: [
        { label: t({ zh: "英文文献", en: "English Literature" }), to: "/english-literature" },
        { label: t({ zh: "中文文献", en: "Chinese Literature" }), to: "/chinese-literature" },
        { label: t({ zh: "API 文档", en: "API Docs" }), to: "/more" },
      ],
    },
    {
      title: t({ zh: "推荐阅读", en: "Reading" }),
      items: [
        { label: t({ zh: "AI 幻觉文献", en: "On AI hallucinations" }), to: "/more" },
        { label: t({ zh: "如何核验引用", en: "How to verify a citation" }), to: "/more" },
        { label: t({ zh: "学术写作实践", en: "Best practices" }), to: "/more" },
      ],
    },
    {
      title: t({ zh: "关于我们", en: "Company" }),
      items: [
        { label: t({ zh: "团队", en: "Team" }), to: "/more" },
        { label: t({ zh: "更新日志", en: "Changelog" }), to: "/more" },
        { label: t({ zh: "用户反馈", en: "Feedback" }), to: "/more" },
      ],
    },
    {
      title: t({ zh: "联系我们", en: "Contact" }),
      items: [
        { label: t({ zh: "商务合作", en: "Partnerships" }), to: "/more" },
        { label: t({ zh: "媒体邀约", en: "Press" }), to: "/more" },
        { label: t({ zh: "更多", en: "More" }), to: "/more" },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />

      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-20 pb-24 md:pb-32">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div
            className="animate-blur-fade-up liquid-glass rounded-full px-5 py-2 mb-8 flex items-center gap-2 text-sm"
            style={{ animationDelay: "150ms" }}
          >
            <Sparkles size={14} />
            <span>{t({ zh: "GhostCite · 文献真实性检测", en: "GhostCite · Citation verification" })}</span>
          </div>

          <h1
            className="animate-blur-fade-up text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal mb-6 leading-tight whitespace-pre-line"
            style={{ animationDelay: "300ms", letterSpacing: "-0.04em" }}
          >
            {t({
              zh: "每一篇引用，\n都真实可信。",
              en: "Every citation,\nbeyond doubt.",
            })}
          </h1>

          <p
            className="animate-blur-fade-up text-base md:text-lg text-gray-300 mb-10 max-w-2xl"
            style={{ animationDelay: "400ms" }}
          >
            {t({
              zh: "输入一个标题。秒级判定真伪。远离虚假引用，远离 AI 幻觉。",
              en: "Enter a title. Verify in seconds. Free from fake citations and AI hallucinations.",
            })}
          </p>

          <div
            className="animate-blur-fade-up liquid-glass rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-3xl"
            style={{ animationDelay: "500ms" }}
          >
            <div className="flex items-center gap-2 flex-1 px-4">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={t({ zh: "粘贴或输入论文标题…", en: "Paste or type a paper title…" })}
                className="bg-transparent outline-none w-full py-3 text-sm sm:text-base placeholder:text-gray-500"
              />
            </div>
            <button
              onClick={submit}
              className="bg-white text-black rounded-xl font-medium px-6 py-3 hover:bg-gray-200 transition-colors text-sm sm:text-base"
            >
              {t({ zh: "开始检测", en: "Verify" })}
            </button>
          </div>
          {error && <p className="animate-blur-fade-up mt-3 text-sm text-red-400">{error}</p>}

          {/* Trust badges module */}
          <div
            className="animate-blur-fade-up mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl"
            style={{ animationDelay: "650ms" }}
          >
            {[
              { icon: ShieldCheck, title: t({ zh: "权威数据库", en: "Authoritative DBs" }), desc: t({ zh: "多源比对，精准定位。", en: "Multi-source cross-check." }) },
              { icon: FileSearch, title: t({ zh: "秒级核验", en: "Seconds to verify" }), desc: t({ zh: "平均三秒给出答案。", en: "Answers in about 3s." }) },
              { icon: BookOpen, title: t({ zh: "中英文双语", en: "Bilingual" }), desc: t({ zh: "覆盖中英文文献。", en: "Chinese & English." }) },
            ].map((m) => (
              <div key={m.title as string} className="liquid-glass rounded-2xl p-4 flex items-start gap-3 text-left">
                <m.icon size={20} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="relative z-10 px-4 sm:px-6 md:px-12 pb-24 md:pb-36">
        <div className="rounded-3xl mx-auto w-full max-w-4xl aspect-[16/9] flex items-center justify-center border border-white/15 bg-transparent backdrop-blur-0">
          <div className="text-gray-400/80 text-sm">{t({ zh: "演示视频即将上线。", en: "Demo coming soon." })}</div>
        </div>
      </section>

      {/* Highlights */}
      <section className="relative z-10 px-4 sm:px-6 md:px-12 pb-24 md:pb-36">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal" style={{ letterSpacing: "-0.03em" }}>
            {t({ zh: "为严谨而生。", en: "Built for rigor." })}
          </h2>
          <span className="text-sm text-gray-400 hidden sm:block">
            {t({ zh: "四个理由。", en: "Four reasons." })}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
          <div className="lg:col-span-7 liquid-glass rounded-3xl p-7 md:p-9 flex flex-col justify-between min-h-[420px] transition-all duration-300 hover:-translate-y-1">
            <div>
              <bigHighlight.icon className="w-8 h-8 mb-6 text-white" strokeWidth={1.5} />
              <div className="text-2xl md:text-3xl font-medium mb-3" style={{ letterSpacing: "-0.02em" }}>
                {bigHighlight.title}
              </div>
              <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-md">
                {bigHighlight.desc}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              {[
                { icon: Database, label: t({ zh: "数据库", en: "Databases" }) },
                { icon: Globe, label: t({ zh: "谷歌学术", en: "Google Scholar" }) },
                { icon: Brain, label: t({ zh: "AI 大模型", en: "Frontier AI" }) },
              ].map((s, idx, arr) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300 liquid-glass rounded-full px-3 py-1.5">
                    <s.icon size={14} /> {s.label}
                  </div>
                  {idx < arr.length - 1 && <div className="w-5 md:w-6 h-px bg-white/25" />}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="arcGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <path d="M 95 5 Q 30 50 95 95" fill="none" stroke="url(#arcGrad)" strokeWidth="0.4" strokeDasharray="0.8 1.2" />
            </svg>

            <div className="flex flex-col gap-5 h-full relative">
              {smallHighlights.map((h, i) => (
                <div
                  key={i}
                  className="liquid-glass rounded-2xl p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 flex-1 min-h-[120px]"
                  style={{
                    marginLeft: i === 1 ? "0" : undefined,
                    marginRight: i === 1 ? "2.5rem" : "0",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="liquid-glass rounded-xl p-2.5 shrink-0">
                      <h.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base md:text-lg font-medium mb-1">{h.title}</div>
                      <div className="text-xs md:text-sm text-gray-400 leading-relaxed">{h.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Scenes */}
      <section className="relative z-10 px-4 sm:px-6 md:px-12 pb-28 md:pb-40">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal" style={{ letterSpacing: "-0.03em" }}>
            {t({ zh: "为每一种写作。", en: "For every kind of writing." })}
          </h2>
          <span className="text-sm text-gray-400 hidden sm:block">
            {t({ zh: "四个场景。", en: "Four moments." })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 lg:gap-x-20 gap-y-32 md:gap-y-44">
          {scenes.map((s, i) => {
            const imageFirst = i % 2 === 0;
            
            const imageBlock = (
              <div key="img" className="flex justify-center">
                <div className="liquid-glass rounded-3xl aspect-[5/3] w-full max-w-sm flex items-center justify-center relative overflow-hidden">
                  <img
                    src={s.image}
                    alt={typeof s.title === "string" ? s.title : ""}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/30 pointer-events-none" />
                </div>
              </div>
            );
            const textBlock = (
              <div key="txt">
                <h3
                  className="text-2xl md:text-3xl font-normal italic mb-4"
                  style={{ fontFamily: "'Cormorant Garamond', 'Times New Roman', serif", letterSpacing: "-0.01em" }}
                >
                  {s.title}
                </h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-md">
                  {s.desc}
                </p>
              </div>
            );
            return (
              <div key={i} className="flex flex-col gap-10">
                {imageFirst ? [imageBlock, textBlock] : [textBlock, imageBlock]}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 md:px-12 pb-10">
        <div className="liquid-glass rounded-3xl p-8 md:p-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="text-lg font-semibold tracking-[-0.04em] mb-3">GhostCite</div>
              <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                {t({
                  zh: "每一篇引用，\n都真实可信。",
                  en: "Every citation,\nbeyond doubt.",
                })}
              </p>
            </div>
            {footerLinks.map((col) => (
              <div key={col.title}>
                <div className="text-sm font-medium mb-3 text-white/90">{col.title}</div>
                <ul className="space-y-2">
                  {col.items.map((it) => (
                    <li key={it.label}>
                      <Link to={it.to} className="text-xs text-gray-400 hover:text-white transition-colors">
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500">
            <div>© {new Date().getFullYear()} GhostCite. {t({ zh: "保留所有权利。", en: "All rights reserved." })}</div>
            <div className="flex gap-5">
              <Link to="/more" className="hover:text-white transition-colors">{t({ zh: "隐私政策", en: "Privacy" })}</Link>
              <Link to="/more" className="hover:text-white transition-colors">{t({ zh: "服务条款", en: "Terms" })}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
