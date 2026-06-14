import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const t = useT();
  const { lang } = useLang();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatTransport = new DefaultChatTransport({
    api: `/api/chat?lang=${lang}`,
  });

  const { messages, sendMessage, status } = useChat({
    transport: chatTransport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const welcomeTitle = t({
    zh: "GhostCite AI 助手",
    en: "GhostCite AI Assistant",
  });

  const welcomeSubtitle = t({
    zh: "问我关于引用核验、文献查找或学术写作的问题。",
    en: "Ask me about citation checks, finding papers, or academic writing.",
  });

  const placeholder = t({
    zh: "输入你的问题…",
    en: "Type your question…",
  });

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 shadow-2xl ${
          open
            ? "bg-white/10 rotate-90 scale-90"
            : "bg-white text-black hover:scale-105"
        }`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <X size={20} className="text-white" />
        ) : (
          <MessageCircle size={22} />
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-[380px] transition-all duration-300 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="liquid-glass rounded-3xl flex flex-col h-[520px] overflow-hidden border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">
                {welcomeTitle}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {isLoading
                  ? t({ zh: "正在思考…", en: "Thinking…" })
                  : t({ zh: "在线", en: "Online" })}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Bot size={24} className="text-gray-300" />
                </div>
                <div className="text-sm text-gray-300 mb-1">{welcomeTitle}</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  {welcomeSubtitle}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isUser ? "bg-white text-black" : "bg-white/10 text-white"
                    }`}
                  >
                    {isUser ? (
                      <User size={14} />
                    ) : (
                      <Bot size={14} />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-white text-black rounded-br-md"
                        : "bg-white/5 text-gray-200 rounded-bl-md"
                    }`}
                  >
                    {msg.parts?.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <span key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 flex-row">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="px-4 py-3 border-t border-white/10 shrink-0"
          >
            <div className="flex items-center gap-2 liquid-glass rounded-2xl px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
