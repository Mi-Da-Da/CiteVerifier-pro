import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = {
  messages?: UIMessage[];
};

const SYSTEM_PROMPTS = {
  zh: `你是 GhostCite 的 AI 学术助手。你专门帮助用户处理学术引用、文献核验和学术写作相关的问题。

你可以帮助用户：
- 解释引用核验结果的含义
- 当发现虚假引用时，建议真实、相关的替代文献
- 回答关于学术写作规范的问题
- 解释如何正确引用不同来源（期刊论文、会议论文、书籍等）
- 提供学术数据库的使用建议
- 帮助理解论文的引用网络和影响力

语气应该专业、简洁、有帮助。回答要准确，不确定时要坦诚说明。优先使用中文回答。`,
  en: `You are GhostCite's AI academic assistant. You specialize in helping users with academic citations, literature verification, and scholarly writing.

You can help users:
- Explain what citation verification results mean
- Suggest real, relevant alternative papers when a citation is found to be fake
- Answer questions about academic writing conventions
- Explain how to properly cite different sources (journal articles, conference papers, books, etc.)
- Provide tips on using academic databases
- Help understand citation networks and paper impact

Your tone should be professional, concise, and helpful. Be accurate, and admit uncertainty when appropriate.`,
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const lang = (url.searchParams.get("lang") as "zh" | "en") ?? "zh";

        const { messages } = (await request.json()) as ChatRequestBody;

        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPTS[lang] ?? SYSTEM_PROMPTS.en,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
