import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRangeFilter, DEFAULT_FROM, DEFAULT_TO } from "@/components/DateRangeFilter";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "Comparison — Idle2Income" },
      { name: "description", content: "Compare before and after revenue recovery." },
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
}

function ComparisonPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);

  const fetchAll = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const [sRes, rRes, uRes] = await Promise.all([
      supabase.from("availability_slots").select("id, unit_id, slot_date, status, is_fragment").gte("slot_date", from).lte("slot_date", to),
      supabase.from("recommendations").select("id, unit_id, status, estimated_recovered"),
      supabase.from("inventory_units").select("id, name"),
    ]);
    setSlots((sRes.data as SlotRow[]) ?? []);
    setRecs((rRes.data as RecRow[]) ?? []);
    setUnits((uRes.data as UnitRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll(fromDate, toDate);
  }, [fetchAll, fromDate, toDate]);

  const dates = useMemo(() => {
    const start = new Date(fromDate + "T00:00:00");
    const end = new Date(toDate + "T00:00:00");
    const arr: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      arr.push(d.toISOString().split("T")[0]);
    }
    return arr;
  }, [fromDate, toDate]);

  // Metrics
  const total = slots.length || 1;
  const beforeUsable = slots.filter((s) => !s.is_fragment && s.status === "available").length;
  const beforePct = ((beforeUsable / total) * 100).toFixed(1);

  const appliedUnits = new Set(recs.filter((r) => r.status === "applied").map((r) => r.unit_id));
  const afterUsable = slots.filter(
    (s) => s.status === "available" || (s.is_fragment && appliedUnits.has(s.unit_id)),
  ).length;
  const afterPct = ((afterUsable / total) * 100).toFixed(1);

  const recovered = recs
    .filter((r) => r.status === "applied")
    .reduce((sum, r) => sum + (r.estimated_recovered ?? 0), 0);

  // Lookups
  const unitMap = new Map(units.map((u) => [u.id, u.name ?? u.id]));
  const uniqueUnitIds = [...new Set(slots.map((s) => s.unit_id))];
  const slotLookup = new Map<string, SlotRow>();
  for (const s of slots) slotLookup.set(`${s.unit_id}-${s.slot_date}`, s);

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      const { error } = await supabase
        .from("recommendations")
        .update({ status: "applied" })
        .eq("status", "pending");
      if (error) throw error;
      toast.success("All pending recommendations applied.");
      await fetchAll(fromDate, toDate);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply recommendations");
    } finally {
      setApplying(false);
    }
  };

  const handleClear = () => {
    setFromDate(DEFAULT_FROM);
    setToDate(DEFAULT_TO);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">Before vs. after revenue recovery</p>
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
            onClick={() => fetchAll(fromDate, toDate)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} onClear={handleClear} />

      {/* Metric badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricBadge label="Before" value={`${beforePct}% usable`} variant="muted" />
        <MetricBadge label="After" value={`${afterPct}% usable`} variant="primary" />
        <MetricBadge label="Revenue Recovered" value={`$${recovered.toLocaleString()}`} variant="primary" />
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

function MetricBadge({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "muted" | "primary";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${variant === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function HeatmapPanel({
  title,
  unitIds,
  unitMap,
  slotLookup,
  appliedUnits,
  dates,
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
                  <th key={d} className="py-1 px-1 text-center text-muted-foreground font-medium whitespace-nowrap">
                    {d.slice(5)}
                  </th>
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
