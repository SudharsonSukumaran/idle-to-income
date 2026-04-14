import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Lightbulb, RefreshCw, Loader2, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "AI Recommendations — Idle2Income" },
      { name: "description", content: "AI-powered revenue recovery recommendations." },
    ],
  }),
  component: RecommendationsPage,
});

interface RecRow {
  id: string;
  unit_id: string;
  issue_type: string;
  severity: string;
  description: string;
  ai_recommendation: string | null;
  estimated_lost_revenue: number;
  estimated_recovered: number;
  status: string;
}

function RecommendationsPage() {
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recommendations")
      .select("*")
      .order("estimated_lost_revenue", { ascending: false });
    setRecs((data as RecRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const totalRecoverable = recs.reduce((s, r) => s + (r.estimated_recovered ?? 0), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const pending = recs.filter((r) => !r.ai_recommendation);
      if (pending.length === 0) {
        toast.info("All recommendations already have AI analysis.");
        setGenerating(false);
        return;
      }

      let completed = 0;
      for (const rec of pending) {
        try {
          const { data, error: fnErr } = await supabase.functions.invoke("generate-recommendation", {
            body: {
              issue_type: rec.issue_type,
              description: rec.description,
              estimated_lost_revenue: rec.estimated_lost_revenue,
            },
          });

          const recommendation = fnErr
            ? `API error: ${fnErr.message}`
            : data?.recommendation ?? "No response";

          await supabase
            .from("recommendations")
            .update({ ai_recommendation: recommendation })
            .eq("id", rec.id);

          completed++;
        } catch (err: any) {
          await supabase
            .from("recommendations")
            .update({ ai_recommendation: `Error: ${err.message}` })
            .eq("id", rec.id);
        }

        // 1-second delay between calls
        if (completed < pending.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      toast.success(`Generated AI analysis for ${completed} recommendation${completed !== 1 ? "s" : ""}.`);
      await fetchRecs();
    } catch (err: any) {
      toast.error(err.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (id: string, status: "applied" | "dismissed") => {
    const { error } = await supabase.from("recommendations").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Recommendation ${status}.`);
      await fetchRecs();
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Recommendations</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered revenue recovery insights</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-md bg-[oklch(0.55_0.18_290)] px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.50_0.18_290)] disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating…" : "Generate AI Recommendations"}
          </button>
          <button
            onClick={fetchRecs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary banner */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <Lightbulb className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-card-foreground">
          Total Recoverable: <span className="text-primary text-lg font-bold">${totalRecoverable.toLocaleString()}</span>
        </span>
      </div>

      {/* Cards */}
      {recs.length === 0 && !loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No recommendations yet. Run merge conflicts first, then add recommendation rows.
        </div>
      ) : (
        <div className="space-y-4">
          {recs.map((rec) => (
            <RecCard key={rec.id} rec={rec} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecCard({
  rec,
  onAction,
}: {
  rec: RecRow;
  onAction: (id: string, status: "applied" | "dismissed") => void;
}) {
  const severityClass =
    rec.severity === "high"
      ? "bg-destructive/10 text-destructive"
      : rec.severity === "medium"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-muted text-muted-foreground";

  const issueColors: Record<string, string> = {
    gap: "bg-primary/10 text-primary",
    fragment: "bg-destructive/10 text-destructive",
    pricing: "bg-amber-500/10 text-amber-600",
    overlap: "bg-[oklch(0.55_0.18_290)]/10 text-[oklch(0.55_0.18_290)]",
  };
  const issueClass = issueColors[rec.issue_type?.toLowerCase()] ?? "bg-muted text-muted-foreground";

  const isActioned = rec.status === "applied" || rec.status === "dismissed";

  return (
    <div className={`rounded-lg border border-border bg-card p-5 space-y-3 ${isActioned ? "opacity-60" : ""}`}>
      {/* Top row: badges + unit */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${issueClass}`}>
          {rec.issue_type}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${severityClass}`}>
          {rec.severity}
        </span>
        <span className="text-sm font-medium text-card-foreground ml-auto">{rec.unit_id}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{rec.description}</p>

      {/* AI recommendation */}
      <div className="rounded-md border-l-4 border-[oklch(0.55_0.18_290)] bg-[oklch(0.55_0.18_290)]/5 px-4 py-3">
        <p className="text-sm text-card-foreground whitespace-pre-line">
          {rec.ai_recommendation ?? (
            <span className="italic text-muted-foreground">Pending AI analysis…</span>
          )}
        </p>
      </div>

      {/* Revenue + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-destructive font-semibold">
            Lost: -${(rec.estimated_lost_revenue ?? 0).toLocaleString()}
          </span>
          <span className="text-primary font-semibold">
            Recover: +${(rec.estimated_recovered ?? 0).toLocaleString()}
          </span>
        </div>

        {!isActioned && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAction(rec.id, "applied")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Check className="h-3.5 w-3.5" />
              Apply
            </button>
            <button
              onClick={() => onAction(rec.id, "dismissed")}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        )}

        {isActioned && (
          <span className={`text-xs font-medium ${rec.status === "applied" ? "text-primary" : "text-muted-foreground"}`}>
            {rec.status === "applied" ? "✓ Applied" : "✗ Dismissed"}
          </span>
        )}
      </div>
    </div>
  );
}
