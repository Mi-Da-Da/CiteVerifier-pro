import { createFileRoute } from "@tanstack/react-router";
import { Info, FileText, HelpCircle, History, Code2, MessageSquare } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/more")({
  component: MorePage,
  head: () => ({
    meta: [
      { title: "More — GhostCite" },
      { name: "description", content: "About GhostCite, contact, FAQ, changelog, API, feedback." },
    ],
  }),
});

function MorePage() {
  const t = useT();

  const sections = [
    {
      id: "about", icon: Info,
      title: t({ zh: "关于我们。", en: "About us." }),
      desc: t({ zh: "为学术界做一件简单的事。让每一条引用，都值得信任。", en: "We do one simple thing for academia. We make every citation worth trusting." }),
    },
    {
      id: "poster", icon: FileText,
      title: t({ zh: "团队成果。", en: "Team Results." }),
      desc: "Poster: GHOSTCITE: A Large-Scale Analysis of Citation Validity in the Age of Large Language Models\n\nGhostCite: A Large-Scale Analysis of Citation Validity in the Age of Large Language Models",
    },
    {
      id: "faq", icon: HelpCircle,
      title: t({ zh: "常见问题。", en: "FAQ." }),
      desc: t({ zh: "汇总高频问题。涵盖原理、覆盖范围与隐私。", en: "The questions we hear most. About how it works, what's covered, and privacy." }),
    },
    {
      id: "changelog", icon: History,
      title: t({ zh: "更新日志。", en: "Changelog." }),
      desc: t({ zh: "持续打磨中。当前 v0.1.0，支持中英文核心检测。", en: "Always improving. v0.1.0 covers core verification in Chinese and English." }),
    },
    {
      id: "api", icon: Code2,
      title: t({ zh: "API 文档。", en: "API." }),
      desc: t({ zh: "面向开发者的接入文档。即将开放。", en: "Developer documentation. Coming soon." }),
    },
    {
      id: "feedback", icon: MessageSquare,
      title: t({ zh: "用户反馈。", en: "Feedback." }),
      desc: t({ zh: "你的建议，会让产品变得更好。", en: "Your ideas make the product better. Tell us." }),
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] -translate-y-8 md:-translate-y-12 flex-col justify-center px-4 sm:px-6 md:px-12 py-12 md:py-16 max-w-6xl mx-auto w-full">
        <h1 className="animate-blur-fade-up text-4xl sm:text-5xl md:text-6xl font-normal mb-5" style={{ letterSpacing: "-0.04em" }}>
          {t({ zh: "更多。", en: "More." })}
        </h1>
        <p className="animate-blur-fade-up text-base sm:text-lg text-gray-300 max-w-2xl mb-12" style={{ animationDelay: "100ms" }}>
          {t({ zh: "了解 GhostCite。和我们保持联系。", en: "Get to know GhostCite. Stay in touch." })}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {sections.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              className="liquid-glass rounded-2xl p-6 animate-blur-fade-up hover:-translate-y-1 transition-transform duration-300"
              style={{ animationDelay: `${150 + i * 60}ms` }}
            >
              <s.icon className="w-7 h-7 mb-4" />
              <div className="text-lg font-medium mb-2">{s.title}</div>
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{s.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
