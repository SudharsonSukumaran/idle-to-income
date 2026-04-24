import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, CheckCircle2, Loader2, Zap, ShieldCheck, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataFilters, getDefaultFilters, applyUnitFilters, type FilterState } from "@/components/DataFilters";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "Optimization — Idle2Income" },
      { name: "description", content: "Optimal resource utilization: before vs. after revenue recovery." },
    ],
  }),
  component: ComparisonPage,
});

interface SlotRow {
  id: string;
  unit_id: string;
  slot_date: string;
  status: string;
  is_fragment: boolean;
}

interface RecRow {
  id: string;
  unit_id: string;
  status: string;
  estimated_recovered: number;
}

interface UnitRow {
  id: string;
  name: string;
  category: string | null;
}

function ComparisonPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);
  const [riskProgress, setRiskProgress] = useState(0);
  const [riskRunning, setRiskRunning] = useState(false);
  const riskTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (f: FilterState) => {
    setLoading(true);
    const [sRes, rRes, uRes] = await Promise.all([
      supabase.from("availability_slots").select("id, unit_id, slot_date, status, is_fragment").gte("slot_date", f.fromDate).lte("slot_date", f.toDate),
      supabase.from("recommendations").select("id, unit_id, status, estimated_recovered"),
      supabase.from("inventory_units").select("id, name, category"),
    ]);
    setSlots((sRes.data as SlotRow[]) ?? []);
    setRecs((rRes.data as RecRow[]) ?? []);
    setUnits((uRes.data as UnitRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll(filters);
  }, [fetchAll, filters]);

  const allUnitIds = useMemo(() => [...new Set(slots.map((s) => s.unit_id))], [slots]);
  const allowedUnits = useMemo(
    () => applyUnitFilters(allUnitIds, units, filters.assetGroup, filters.categoryType),
    [allUnitIds, units, filters.assetGroup, filters.categoryType],
  );

  const filteredSlots = useMemo(() => slots.filter((s) => allowedUnits.has(s.unit_id)), [slots, allowedUnits]);
  const filteredRecs = useMemo(() => recs.filter((r) => allowedUnits.has(r.unit_id)), [recs, allowedUnits]);

  const dates = useMemo(() => {
    const start = new Date(filters.fromDate + "T00:00:00");
    const end = new Date(filters.toDate + "T00:00:00");
    const arr: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      arr.push(d.toISOString().split("T")[0]);
    }
    return arr;
  }, [filters.fromDate, filters.toDate]);

  // Metrics
  const total = filteredSlots.length || 1;
  const beforeUsable = filteredSlots.filter((s) => !s.is_fragment && s.status === "available").length;
  const beforePct = ((beforeUsable / total) * 100).toFixed(1);

  const appliedUnits = new Set(filteredRecs.filter((r) => r.status === "applied").map((r) => r.unit_id));
  const afterUsable = filteredSlots.filter(
    (s) => s.status === "available" || (s.is_fragment && appliedUnits.has(s.unit_id)),
  ).length;
  const afterPct = ((afterUsable / total) * 100).toFixed(1);

  const recovered = filteredRecs
    .filter((r) => r.status === "applied")
    .reduce((sum, r) => sum + (r.estimated_recovered ?? 0), 0);

  const improvementPts = Math.max(0, Number(afterPct) - Number(beforePct));
  const targetRisk = Math.min(100, Math.round(60 + improvementPts * 1.2));

  // Lookups
  const unitMap = new Map(units.map((u) => [u.id, u.name ?? u.id]));
  const uniqueUnitIds = [...allowedUnits];
  const slotLookup = new Map<string, SlotRow>();
  for (const s of filteredSlots) slotLookup.set(`${s.unit_id}-${s.slot_date}`, s);

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      const { error } = await supabase
        .from("recommendations")
        .update({ status: "applied" })
        .eq("status", "pending");
      if (error) throw error;
      toast.success("All pending recommendations applied.");
      await fetchAll(filters);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply recommendations");
    } finally {
      setApplying(false);
    }
  };

  const startRiskScan = () => {
    if (riskTimer.current) clearInterval(riskTimer.current);
    setRiskProgress(0);
    setRiskRunning(true);
    const tick = 60; // ms
    riskTimer.current = setInterval(() => {
      setRiskProgress((p) => {
        const next = p + Math.random() * 3.5 + 0.8;
        if (next >= targetRisk) {
          if (riskTimer.current) clearInterval(riskTimer.current);
          setRiskRunning(false);
          return targetRisk;
        }
        return next;
      });
    }, tick);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (riskTimer.current) clearInterval(riskTimer.current);
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Optimization</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Optimal resource utilization — before vs. after revenue recovery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleApplyAll}
            disabled={applying}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {applying ? "Applying…" : "Apply All Recommendations"}
          </button>
          <button
            onClick={() => fetchAll(filters)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Optimal Resource Utilization hero */}
      <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 flex items-start gap-3">
        <ShieldCheck className="h-6 w-6 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Optimal Resource Utilization</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Recovered fragments are reallocated to maximise occupancy without overbooking. Compare the heatmaps below to see the lift.
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-muted-foreground">Improvement</span>
          <span className="text-2xl font-bold text-primary">+{improvementPts.toFixed(1)} pts</span>
        </div>
      </div>

      {/* Filters */}
      <DataFilters filters={filters} onFiltersChange={setFilters} />

      {/* Metric badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricBadge label="Before" value={`${beforePct}% usable`} variant="muted" />
        <MetricBadge label="After" value={`${afterPct}% usable`} variant="primary" />
        <MetricBadge label="Revenue Recovered" value={`$${recovered.toLocaleString()}`} variant="primary" />
      </div>

      {/* Live risk visualization (defrag-style) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-card-foreground">Live Risk Visualization</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">demo</span>
          </div>
          <button
            onClick={startRiskScan}
            disabled={riskRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent/10 disabled:opacity-50"
          >
            {riskRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {riskRunning ? "Optimizing…" : "Run optimization"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {riskRunning
            ? "Optimization in progress — defragmenting availability and reallocating capacity…"
            : riskProgress > 0
              ? `Risk reduction improving — ${riskProgress.toFixed(0)}% of inventory optimised.`
              : "Click run to simulate live risk reduction across your inventory."}
        </p>
        {/* Defrag-style cells */}
        <DefragBar progress={riskProgress} />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Fragmented</span>
          <span className="font-semibold text-primary">{riskProgress.toFixed(0)}%</span>
          <span>Optimised</span>
        </div>
      </div>

      {/* Side-by-side grids */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HeatmapPanel
          title="Before"
          unitIds={uniqueUnitIds}
          unitMap={unitMap}
          slotLookup={slotLookup}
          appliedUnits={new Set()}
          dates={dates}
        />
        <HeatmapPanel
          title="After"
          unitIds={uniqueUnitIds}
          unitMap={unitMap}
          slotLookup={slotLookup}
          appliedUnits={appliedUnits}
          dates={dates}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Fragment</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-muted" /> Booked / Blocked</span>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, variant }: { label: string; value: string; variant: "muted" | "primary" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${variant === "primary" ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function HeatmapPanel({
  title, unitIds, unitMap, slotLookup, appliedUnits, dates,
}: {
  title: string;
  unitIds: string[];
  unitMap: Map<string, string>;
  slotLookup: Map<string, SlotRow>;
  appliedUnits: Set<string>;
  dates: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 overflow-hidden">
      <h2 className="text-sm font-semibold text-card-foreground mb-3">{title}</h2>
      {unitIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="py-1 px-2 text-left text-muted-foreground font-medium sticky left-0 bg-card z-10">Unit</th>
                {dates.map((d) => (
                  <th key={d} className="py-1 px-1 text-center text-muted-foreground font-medium whitespace-nowrap">{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unitIds.map((uid) => (
                <tr key={uid}>
                  <td className="py-1 px-2 font-medium text-card-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                    {(unitMap.get(uid) ?? uid).slice(0, 10)}
                  </td>
                  {dates.map((date) => {
                    const slot = slotLookup.get(`${uid}-${date}`);
                    const cellColor = getCellColor(slot, appliedUnits);
                    return (
                      <td key={date} className="py-1 px-1 text-center">
                        <div className={`w-8 h-6 rounded-sm ${cellColor}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getCellColor(slot: SlotRow | undefined, appliedUnits: Set<string>): string {
  if (!slot) return "bg-muted/30";
  if (slot.is_fragment && appliedUnits.has(slot.unit_id)) return "bg-emerald-500/80";
  if (slot.is_fragment) return "bg-red-500/80";
  if (slot.status === "available") return "bg-emerald-500/80";
  return "bg-muted";
}

function DefragBar({ progress }: { progress: number }) {
  // 60 cells in a windows-defrag style strip
  const total = 60;
  const filled = Math.round((progress / 100) * total);
  return (
    <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-[2px] rounded-md border border-border bg-muted/30 p-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const isOpt = i < filled;
        // fragmented cells get amber/red randomness; optimised cells become emerald
        const tone = isOpt
          ? "bg-emerald-500"
          : i % 7 === 0
            ? "bg-red-500/70"
            : i % 3 === 0
              ? "bg-amber-400/70"
              : "bg-muted-foreground/30";
        return <div key={i} className={`h-4 rounded-[2px] transition-colors duration-200 ${tone}`} />;
      })}
    </div>
  );
}
