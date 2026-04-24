import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/ai-chat")({
  head: () => ({
    meta: [
      { title: "AI Chat / Recommendations — Idle2Income" },
      { name: "description", content: "Ask the assistant for revenue recovery insights summarised from your live data." },
    ],
  }),
  component: AiChatPage,
});

const SUGGESTIONS = [
  "Summarise this week's biggest revenue leaks",
  "Where am I most under-utilised?",
  "How much revenue can I recover right now?",
  "Which units have the most fragmentation?",
];

interface Msg { role: "user" | "assistant"; text: string }

interface SystemSnapshot {
  totalSlots: number;
  fragmented: number;
  underUtilized: number;
  overBooked: number;
  revenueAtRisk: number;
  recoverable: number;
  topUnits: { unit_id: string; loss: number }[];
}

function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm your revenue copilot. I summarise insights from your live availability, conflicts, and recommendations. Pick a prompt below or ask anything." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [slotsRes, recsRes] = await Promise.all([
        supabase
          .from("availability_slots")
          .select("unit_id, status, is_fragment, issue_type, occupancy, capacity, adult_count, price"),
        supabase
          .from("recommendations")
          .select("unit_id, estimated_lost_revenue, estimated_recovered, status"),
      ]);
      const slots = (slotsRes.data ?? []) as any[];
      const recs = (recsRes.data ?? []) as any[];
      const fragmented = slots.filter((s) => s.is_fragment).length;
      const underUtilized = slots.filter((s) => {
        const occ = s.occupancy ?? s.adult_count ?? 0;
        const cap = s.capacity ?? 0;
        return s.status === "booked" && cap > 0 && occ < cap;
      }).length;
      const overBooked = slots.filter((s) => {
        const occ = s.occupancy ?? s.adult_count ?? 0;
        const cap = s.capacity ?? 0;
        return (cap > 0 && occ > cap) || s.issue_type === "overbooking";
      }).length;
      const revenueAtRisk = slots
        .filter((s) => s.is_fragment)
        .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const recoverable = recs
        .filter((r) => r.status !== "dismissed")
        .reduce((sum, r) => sum + (Number(r.estimated_recovered) || 0), 0);

      const lossByUnit = new Map<string, number>();
      for (const r of recs) {
        lossByUnit.set(r.unit_id, (lossByUnit.get(r.unit_id) ?? 0) + (Number(r.estimated_lost_revenue) || 0));
      }
      const topUnits = [...lossByUnit.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([unit_id, loss]) => ({ unit_id, loss }));

      setSnapshot({
        totalSlots: slots.length,
        fragmented,
        underUtilized,
        overBooked,
        revenueAtRisk: Math.round(revenueAtRisk),
        recoverable: Math.round(recoverable),
        topUnits,
      });
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const buildAnswer = (q: string, snap: SystemSnapshot): string => {
    const lower = q.toLowerCase();
    const $ = (n: number) => `$${n.toLocaleString()}`;
    const top = snap.topUnits[0];

    if (/under|utili[sz]/.test(lower)) {
      return [
        `**Under-utilisation summary**`,
        ``,
        `- ${snap.underUtilized} booked slot(s) are running below capacity.`,
        `- Most impacted unit: **${top?.unit_id ?? "n/a"}** (${$(top?.loss ?? 0)} lost).`,
        `- Recommended action: bundle low-occupancy stays with add-ons or apply targeted discounts.`,
      ].join("\n");
    }
    if (/fragment/.test(lower)) {
      return [
        `**Fragmentation analysis**`,
        ``,
        `- ${snap.fragmented} fragmented slot(s) detected (out of ${snap.totalSlots}).`,
        `- Estimated revenue at risk: **${$(snap.revenueAtRisk)}**.`,
        `- Apply orphan-night promotions or merge isolated availability to recover value.`,
      ].join("\n");
    }
    if (/over|risk|conflict/.test(lower)) {
      return [
        `**Overbooking risk**`,
        ``,
        `- ${snap.overBooked} slot(s) exceed capacity and need resolution.`,
        `- Review the **Conflicts** page and trigger Run Merge to auto-resolve duplicates.`,
      ].join("\n");
    }
    if (/recover|revenue|earn|money/.test(lower)) {
      return [
        `**Recoverable revenue**`,
        ``,
        `- Total recoverable: **${$(snap.recoverable)}** across pending recommendations.`,
        `- Revenue currently at risk: ${$(snap.revenueAtRisk)}.`,
        `- Open **AI Recommendations** and Apply All to lock in projected gains.`,
      ].join("\n");
    }
    if (/leak|biggest|top|worst/.test(lower)) {
      const lines = snap.topUnits.length
        ? snap.topUnits.map((u, i) => `${i + 1}. ${u.unit_id} — ${$(u.loss)} lost`)
        : ["No leaks detected — inventory is healthy."];
      return [
        `**Top revenue leaks this week**`,
        ``,
        ...lines,
        ``,
        `Estimated total recoverable: **${$(snap.recoverable)}**.`,
      ].join("\n");
    }
    // Default executive summary
    return [
      `**Portfolio snapshot**`,
      ``,
      `- Total slots tracked: ${snap.totalSlots}`,
      `- Fragmented: ${snap.fragmented} · Under-utilised: ${snap.underUtilized} · Overbooked: ${snap.overBooked}`,
      `- Revenue at risk: **${$(snap.revenueAtRisk)}** · Recoverable: **${$(snap.recoverable)}**`,
      ``,
      `Ask me about fragmentation, under-utilisation, overbooking, or top revenue leaks for a focused breakdown.`,
    ].join("\n");
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setLoading(true);
    // Simulated thinking delay for UX
    await new Promise((r) => setTimeout(r, 450));
    const snap = snapshot ?? {
      totalSlots: 0, fragmented: 0, underUtilized: 0, overBooked: 0,
      revenueAtRisk: 0, recoverable: 0, topUnits: [],
    };
    const answer = buildAnswer(t, snap);
    setMessages((m) => [...m, { role: "assistant", text: answer }]);
    setLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> AI Chat / Recommendations
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversational insights summarised from your live system data.
          </p>
        </div>
        <Link
          to="/recommendations"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent/10"
        >
          <Sparkles className="h-3.5 w-3.5" /> Structured recommendations
        </Link>
      </div>

      {snapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Slots" value={snapshot.totalSlots} />
          <MiniStat label="Fragmented" value={snapshot.fragmented} tone="red" />
          <MiniStat label="At Risk" value={`$${snapshot.revenueAtRisk.toLocaleString()}`} tone="amber" />
          <MiniStat label="Recoverable" value={`$${snapshot.recoverable.toLocaleString()}`} tone="green" />
        </div>
      )}

      <div ref={scrollRef} className="rounded-lg border border-border bg-card p-4 space-y-3 min-h-[340px] max-h-[480px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-card-foreground"
              }`}
            >
              <SimpleMarkdown text={m.text} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Summarising…
            </div>
          </div>
        )}
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
          placeholder="Ask about availability, pricing, conflicts, or recovery…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: "red" | "amber" | "green" }) {
  const color =
    tone === "red" ? "text-red-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "green" ? "text-emerald-600"
    : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

/** Tiny markdown renderer: **bold** and bullet lines. Keeps deps minimal. */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.trim() === "") return <div key={i} className="h-1" />;
        const isBullet = /^\s*[-*]\s+/.test(line);
        const content = line.replace(/^\s*[-*]\s+/, "");
        return (
          <div key={i} className={isBullet ? "pl-3 relative" : ""}>
            {isBullet && <span className="absolute left-0">•</span>}
            {renderInline(content)}
          </div>
        );
      })}
    </div>
  );
}
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}