import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Msg { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "Where am I losing the most revenue?",
  "Show top under-utilised units",
  "How much can I recover today?",
];

function quickAnswer(q: string): string {
  const lower = q.toLowerCase();
  if (/under|utili[sz]/.test(lower))
    return "Under-utilised slots are running below capacity. Open AI Recommendations to bundle add-ons or apply targeted discounts.";
  if (/fragment/.test(lower))
    return "Fragmentation creates orphan nights. Review the Conflicts page → Fragmentation tab and apply merge promotions.";
  if (/over|conflict|risk/.test(lower))
    return "Overbookings need quick resolution. Visit Conflicts → Overbooking and run auto-merge.";
  if (/recover|revenue|earn|money|losing|leak/.test(lower))
    return "Open Aura Recommendations to see recoverable revenue across pending opportunities, then Apply All to lock in projected gains.";
  return "I can summarise availability, conflicts, fragmentation, and revenue recovery. Try one of the suggestions below or open Aura Assistant for a deeper view.";
}

export function AskMeBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi, I'm Aura — your revenue copilot. Ask anything about availability, conflicts, or recovery." },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (t: string) => {
    const text = t.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    setMessages((m) => [...m, { role: "assistant", text: quickAnswer(text) }]);
    setLoading(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Aura assistant"
          className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] ring-1 ring-primary/30 hover:shadow-[0_10px_40px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:scale-[1.02] transition-all"
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-white/20 blur-sm group-hover:bg-white/30" />
            <Sparkles className="relative h-4 w-4" />
          </span>
          Aura
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-primary/10 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                <Sparkles className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-tight text-card-foreground">Aura Assistant</p>
                <p className="text-[10px] text-muted-foreground">Revenue copilot · online</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent/30"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-card-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-xs flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/20"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

          <Link
            to="/ai-chat"
            className="border-t border-border/60 bg-muted/40 px-3 py-2 text-[10px] text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Open full Aura Assistant →
          </Link>
        </div>
      )}
    </>
  );
}
