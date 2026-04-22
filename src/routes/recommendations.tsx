import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Lightbulb, RefreshCw, Loader2, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataFilters, getDefaultFilters, applyUnitFilters, type FilterState } from "@/components/DataFilters";

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

interface UnitRow {
  id: string;
  category: string | null;
}

interface UnitPartyInfo {
  party_size: number;
  adult_count: number;
}

function RecommendationsPage() {
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [partyByUnit, setPartyByUnit] = useState<Map<string, UnitPartyInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);

  const fetchRecs = useCallback(async (f: FilterState) => {
    setLoading(true);
    const [slotRes, unitRes] = await Promise.all([
      supabase.from("availability_slots").select("unit_id, party_size, adult_count").gte("slot_date", f.fromDate).lte("slot_date", f.toDate),
      supabase.from("inventory_units").select("id, category"),
    ]);
    const slotData = (slotRes.data ?? []) as any[];
    const unitIds = [...new Set(slotData.map((s) => s.unit_id).filter(Boolean))];
    // Aggregate max party_size and adult_count per unit
    const partyMap = new Map<string, UnitPartyInfo>();
    for (const s of slotData) {
      if (!s.unit_id) continue;
      const existing = partyMap.get(s.unit_id) ?? { party_size: 0, adult_count: 0 };
      partyMap.set(s.unit_id, {
        party_size: Math.max(existing.party_size, s.party_size ?? 1),
        adult_count: Math.max(existing.adult_count, s.adult_count ?? 1),
      });
    }
    setPartyByUnit(partyMap);
    setUnits((unitRes.data as UnitRow[]) ?? []);

    let recsData: RecRow[] = [];
    if (unitIds.length > 0) {
      const { data } = await supabase
        .from("recommendations")
        .select("*")
        .in("unit_id", unitIds)
        .order("estimated_lost_revenue", { ascending: false });
      recsData = (data as RecRow[]) ?? [];
    }
    setRecs(recsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecs(filters);
  }, [fetchRecs, filters]);

  // Apply unit filters client-side
  const allUnitIds = useMemo(() => [...new Set(recs.map((r) => r.unit_id))], [recs]);
  const allowedUnits = useMemo(
    () => applyUnitFilters(allUnitIds, units, filters.assetGroup, filters.categoryType),
    [allUnitIds, units, filters.assetGroup, filters.categoryType],
  );
  const filteredRecs = useMemo(() => recs.filter((r) => allowedUnits.has(r.unit_id)), [recs, allowedUnits]);

  const totalRecoverable = filteredRecs.reduce((s, r) => s + (r.estimated_recovered ?? 0), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const pending = filteredRecs.filter((r) => !r.ai_recommendation);
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

        if (completed < pending.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      toast.success(`Generated AI analysis for ${completed} recommendation${completed !== 1 ? "s" : ""}.`);
      await fetchRecs(filters);
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
      await fetchRecs(filters);
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
            onClick={() => fetchRecs(filters)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <DataFilters filters={filters} onFiltersChange={setFilters} />

      {/* Summary banner */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <Lightbulb className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-card-foreground">
          Total Recoverable: <span className="text-primary text-lg font-bold">${totalRecoverable.toLocaleString()}</span>
        </span>
      </div>

      {/* Cards */}
      {filteredRecs.length === 0 && !loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No recommendations yet. Run merge conflicts first, then add recommendation rows.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecs.map((rec) => (
            <RecCard key={rec.id} rec={rec} party={partyByUnit.get(rec.unit_id)} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecCard({
  rec,
  party,
  onAction,
}: {
  rec: RecRow;
  party?: UnitPartyInfo;
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
    overbooking: "bg-red-900/15 text-red-800",
    room_misallocation: "bg-orange-500/15 text-orange-600",
  };
  const issueClass = issueColors[rec.issue_type?.toLowerCase()] ?? "bg-muted text-muted-foreground";

  const isActioned = rec.status === "applied" || rec.status === "dismissed";

  return (
    <div className={`rounded-lg border border-border bg-card p-5 space-y-3 ${isActioned ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${issueClass}`}>
          {rec.issue_type}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${severityClass}`}>
          {rec.severity}
        </span>
        <span className="text-sm font-medium text-card-foreground ml-auto">{rec.unit_id}</span>
      </div>

      <p className="text-sm text-muted-foreground">{rec.description}</p>

      {party && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5">
            Party: <span className="ml-1 font-semibold text-card-foreground">{party.party_size}</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5">
            Adults: <span className="ml-1 font-semibold text-card-foreground">{party.adult_count}</span>
          </span>
        </div>
      )}

      <div className="rounded-md border-l-4 border-[oklch(0.55_0.18_290)] bg-[oklch(0.55_0.18_290)]/5 px-4 py-3">
        <p className="text-sm text-card-foreground whitespace-pre-line">
          {rec.ai_recommendation ?? (
            <span className="italic text-muted-foreground">Pending AI analysis…</span>
          )}
        </p>
      </div>

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
