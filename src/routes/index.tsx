import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, LayoutGrid, AlertTriangle, DollarSign, Lightbulb, Clock, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { detectFragmentation } from "@/lib/detect-fragmentation";
import { supabase } from "@/integrations/supabase/client";
import { DataFilters, getDefaultFilters, applyUnitFilters, type FilterState } from "@/components/DataFilters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Idle2Income" },
      { name: "description", content: "Revenue recovery dashboard overview." },
    ],
  }),
  component: DashboardPage,
});

interface SlotRow {
  id: string;
  unit_id: string;
  slot_date: string;
  status: string;
  price: number;
  is_fragment: boolean;
}

interface RecommendationRow {
  id: string;
  unit_id: string;
  issue_type: string;
  estimated_lost_revenue: number;
}

interface UnitRow {
  id: string;
  name: string;
  category: string | null;
}

function DashboardPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);

  const fetchAll = useCallback(async (f: FilterState) => {
    setLoading(true);
    const [slotsRes, recsRes, unitsRes] = await Promise.all([
      supabase.from("availability_slots").select("id, unit_id, slot_date, status, price, is_fragment").gte("slot_date", f.fromDate).lte("slot_date", f.toDate),
      supabase.from("recommendations").select("id, unit_id, issue_type, estimated_lost_revenue").order("estimated_lost_revenue", { ascending: false }).limit(5),
      supabase.from("inventory_units").select("id, name, category"),
    ]);
    setSlots((slotsRes.data as SlotRow[]) ?? []);
    setRecs((recsRes.data as RecommendationRow[]) ?? []);
    setUnits((unitsRes.data as UnitRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll(filters);
  }, [fetchAll, filters]);

  // Apply unit filters
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

  const totalSlots = filteredSlots.length;
  const fragmented = filteredSlots.filter((s) => s.is_fragment).length;
  const revenueAtRisk = filteredSlots.filter((s) => s.is_fragment).reduce((sum, s) => sum + (s.price ?? 0), 0);
  const totalRecs = filteredRecs.length;

  const unitMap = new Map(units.map((u) => [u.id, u.name ?? u.id]));
  const uniqueUnitIds = [...allowedUnits];

  const slotLookup = new Map<string, SlotRow>();
  for (const s of filteredSlots) {
    slotLookup.set(`${s.unit_id}-${s.slot_date}`, s);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Revenue recovery overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setDetecting(true);
              try {
                const count = await detectFragmentation();
                toast.success(`Fragmentation detection complete. ${count} issues found.`);
                await fetchAll(filters);
              } catch (err: any) {
                toast.error(err.message ?? "Detection failed");
              } finally {
                setDetecting(false);
              }
            }}
            disabled={detecting}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {detecting ? "Detecting…" : "Detect Fragmentation"}
          </button>
          <button
            onClick={() => fetchAll(filters)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <DataFilters filters={filters} onFiltersChange={setFilters} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={LayoutGrid} label="Total Slots" value={totalSlots} />
        <KpiCard icon={AlertTriangle} label="Fragmented" value={fragmented} variant="red" />
        <KpiCard icon={DollarSign} label="Revenue at Risk ($)" value={`$${revenueAtRisk.toLocaleString()}`} variant="amber" />
        <KpiCard icon={Lightbulb} label="AI Recommendations" value={totalRecs} variant="green" />
      </div>

      {/* Main content: heatmap + issues sidebar */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Heatmap */}
        <div className="flex-1 rounded-lg border border-border bg-card p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-card-foreground mb-3">Availability Heatmap</h2>
          {uniqueUnitIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data. Load demo data from the Upload page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    <th className="text-left py-1 px-2 text-muted-foreground font-medium sticky left-0 bg-card z-10">Unit</th>
                    {dates.map((d) => (
                      <th key={d} className="py-1 px-1 text-center text-muted-foreground font-medium whitespace-nowrap">
                        {d.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueUnitIds.map((unitId) => (
                    <tr key={unitId}>
                      <td className="py-1 px-2 font-medium text-card-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                        {abbreviate(unitMap.get(unitId) ?? unitId)}
                      </td>
                      {dates.map((date) => {
                        const slot = slotLookup.get(`${unitId}-${date}`);
                        return (
                          <td key={date} className="py-1 px-1 text-center">
                            <HeatmapCell slot={slot} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Available</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Fragment</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-muted" /> Booked/Blocked</span>
          </div>
        </div>

        {/* Top 5 issues */}
        <div className="w-full xl:w-72 shrink-0 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-3">Top 5 Issues</h2>
          {filteredRecs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recommendations yet.</p>
          ) : (
            <ul className="space-y-3">
              {filteredRecs.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-card-foreground">{r.issue_type}</p>
                    <p className="text-xs text-muted-foreground">{r.unit_id}</p>
                  </div>
                  <span className="text-xs font-semibold text-destructive whitespace-nowrap">
                    -${(r.estimated_lost_revenue ?? 0).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-lg border border-border bg-card p-4">
        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-card-foreground">Before:</strong> Manual effort = 4 hours/day
          </span>
          <span className="text-muted-foreground">
            <strong className="text-primary">After:</strong> Automated = 8 minutes
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function KpiCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  variant?: "red" | "amber" | "green";
}) {
  const iconColor =
    variant === "red"
      ? "text-destructive"
      : variant === "amber"
        ? "text-amber-500"
        : variant === "green"
          ? "text-primary"
          : "text-muted-foreground";

  const valueColor =
    variant === "red"
      ? "text-destructive"
      : variant === "amber"
        ? "text-amber-500"
        : variant === "green"
          ? "text-primary"
          : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function HeatmapCell({ slot }: { slot?: SlotRow }) {
  if (!slot) {
    return <div className="w-8 h-6 rounded-sm bg-muted/30" />;
  }

  if (slot.is_fragment) {
    return <div className="w-8 h-6 rounded-sm bg-red-500/80" title="Fragment" />;
  }

  if (slot.status === "available") {
    return <div className="w-8 h-6 rounded-sm bg-emerald-500/80" title="Available" />;
  }

  // booked or blocked
  return <div className="w-8 h-6 rounded-sm bg-muted" title={slot.status} />;
}

function abbreviate(name: string): string {
  if (name.length <= 10) return name;
  return name.slice(0, 9) + "…";
}
