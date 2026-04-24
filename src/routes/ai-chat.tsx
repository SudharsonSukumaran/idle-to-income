import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ai-chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — Idle2Income" },
      { name: "description", content: "Ask the assistant for revenue recovery insights." },
    ],
  }),
  component: AiChatPage,
});

const SUGGESTIONS = [
  "Which rooms are most under-utilised this week?",
  "Show me the biggest revenue leaks from fragmentation.",
  "What add-ons should I bundle to lift occupancy?",
  "Forecast revenue if I apply all current recommendations.",
];

interface Msg { role: "user" | "assistant"; text: string }

function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm your revenue copilot. Ask me about availability, fragmentation, or pricing." },
  ]);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: t },
      { role: "assistant", text: "Demo response — connect the AI gateway to enable live answers. Meanwhile, check the AI Recommendations page for actionable items." },
    ]);
    setInput("");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> AI Chat
          </h1>
          <p className="text-sm text-muted-foreground">Conversational layer over your recommendations.</p>
        </div>
        <Link
          to="/recommendations"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent/10"
        >
          <Sparkles className="h-3.5 w-3.5" /> View structured recommendations
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3 min-h-[320px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-card-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent/10"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about availability, pricing, or recovery…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}