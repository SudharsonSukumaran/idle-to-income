import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, LayoutGrid, AlertTriangle, DollarSign, Lightbulb, Clock, Search, Loader2, Users, BedDouble, CheckCircle2, TrendingDown, ShieldAlert } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import { detectFragmentation } from "@/lib/detect-fragmentation";
import { supabase } from "@/integrations/supabase/client";
import { loadDemoData } from "@/lib/demo-data";
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
  adult_count: number;
  occupancy?: number | null;
  capacity?: number | null;
  bed_type?: string | null;
  room_type?: string | null;
  issue_type?: string | null;
}

interface RecommendationRow {
  id: string;
  unit_id: string;
  issue_type: string;
  estimated_lost_revenue: number;
}

interface AppliedRecRow {
  slot_date: string;
  estimated_recovered: number;
}

interface UnitRow {
  id: string;
  name: string;
  category: string | null;
  capacity: number | null;
}

function DashboardPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [appliedRecs, setAppliedRecs] = useState<AppliedRecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);

  const fetchAll = useCallback(async (f: FilterState) => {
    setLoading(true);
    const [slotsRes, recsRes, unitsRes, appliedRes] = await Promise.all([
      supabase.from("availability_slots").select("id, unit_id, slot_date, status, price, is_fragment, adult_count, occupancy, capacity, bed_type, room_type, issue_type").gte("slot_date", f.fromDate).lte("slot_date", f.toDate),
      supabase.from("recommendations").select("id, unit_id, issue_type, estimated_lost_revenue").order("estimated_lost_revenue", { ascending: false }).limit(5),
      supabase.from("inventory_units").select("id, name, category, capacity"),
      supabase
        .from("recommendations")
        .select("unit_id, estimated_recovered, status")
        .eq("status", "applied"),
    ]);
    setSlots((slotsRes.data as SlotRow[]) ?? []);
    setRecs((recsRes.data as RecommendationRow[]) ?? []);
    setUnits((unitsRes.data as UnitRow[]) ?? []);
    // Map recommendations -> dates via slot dates per unit (recommendations have no date col).
    // Distribute recovered evenly across that unit's filtered slot dates.
    const allSlots = (slotsRes.data as SlotRow[]) ?? [];
    const datesByUnit = new Map<string, string[]>();
    for (const s of allSlots) {
      if (!datesByUnit.has(s.unit_id)) datesByUnit.set(s.unit_id, []);
      datesByUnit.get(s.unit_id)!.push(s.slot_date);
    }
    const applied: AppliedRecRow[] = [];
    for (const r of (appliedRes.data as any[]) ?? []) {
      const dates = datesByUnit.get(r.unit_id) ?? [];
      if (dates.length === 0) continue;
      const per = (r.estimated_recovered ?? 0) / dates.length;
      for (const d of dates) applied.push({ slot_date: d, estimated_recovered: per });
    }
    setAppliedRecs(applied);
    setLoading(false);
  }, []);

  // Auto-seed demo data on first launch if DB is empty
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (seeded) {
        await fetchAll(filters);
        return;
      }
      const { count } = await supabase
        .from("availability_slots")
        .select("id", { count: "exact", head: true });
      if (cancelled) return;
      if ((count ?? 0) === 0) {
        try {
          await loadDemoData();
          toast.success("Demo data loaded automatically");
        } catch (e: any) {
          console.error("Auto-seed failed", e);
        }
      }
      setSeeded(true);
      await fetchAll(filters);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, seeded]);

  // Apply unit filters
  const allUnitIds = useMemo(() => [...new Set(slots.map((s) => s.unit_id))], [slots]);
  const allowedUnits = useMemo(
    () => applyUnitFilters(allUnitIds, units, filters.assetGroup, filters.categoryType),
    [allUnitIds, units, filters.assetGroup, filters.categoryType],
  );

  const filteredSlots = useMemo(() => slots.filter((s) => allowedUnits.has(s.unit_id)), [slots, allowedUnits]);

  // Apply room_type + occupancy filters
  const finalSlots = useMemo(() => {
    return filteredSlots.filter((s) => {
      if (filters.roomType !== "all" && s.room_type !== filters.roomType) return false;
      if (filters.occupancy !== "all") {
        const occ = s.occupancy ?? s.adult_count ?? 0;
        if (filters.occupancy === "1" && occ !== 1) return false;
        if (filters.occupancy === "2" && occ !== 2) return false;
        if (filters.occupancy === "3+" && occ < 3) return false;
      }
      return true;
    });
  }, [filteredSlots, filters.roomType, filters.occupancy]);

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

  const totalSlots = finalSlots.length;
  const fragmented = finalSlots.filter((s) => s.is_fragment).length;
  const revenueAtRisk = finalSlots.filter((s) => s.is_fragment).reduce((sum, s) => sum + (s.price ?? 0), 0);
  const totalRecs = filteredRecs.length;

  // Avg occupancy = SUM(adult_count) / SUM(capacity) * 100
  const capacityMap = new Map(units.map((u) => [u.id, u.capacity ?? 0]));
  const sumAdults = finalSlots.reduce((s, sl) => s + (sl.occupancy ?? sl.adult_count ?? 0), 0);
  const sumCapacity = finalSlots.reduce((s, sl) => s + (sl.capacity ?? capacityMap.get(sl.unit_id) ?? 0), 0);
  const avgOccupancy = sumCapacity > 0 ? (sumAdults / sumCapacity) * 100 : 0;

  const vacantCount = finalSlots.filter((s) => s.status === "available" && !s.is_fragment).length;
  const bookedCount = finalSlots.filter((s) => s.status === "booked" || s.status === "blocked").length;

  // Under/over booking metrics
  const underUtilized = finalSlots.filter((s) => {
    if (s.status !== "booked") return false;
    const occ = s.occupancy ?? s.adult_count ?? 0;
    const cap = s.capacity ?? 1;
    return occ < cap || s.issue_type === "under_utilized" || s.issue_type === "underbooking";
  }).length;
  const overBooked = finalSlots.filter((s) => {
    const occ = s.occupancy ?? s.adult_count ?? 0;
    const cap = s.capacity ?? 1;
    return s.issue_type === "overbooking" || occ > cap;
  }).length;
  const underRevLoss = finalSlots
    .filter((s) => {
      const occ = s.occupancy ?? s.adult_count ?? 0;
      const cap = s.capacity ?? 1;
      return s.status === "booked" && occ < cap;
    })
    .reduce((sum, s) => {
      const occ = s.occupancy ?? s.adult_count ?? 0;
      const cap = s.capacity ?? 1;
      const perPerson = (s.price ?? 0) / Math.max(cap, 1);
      return sum + perPerson * (cap - occ);
    }, 0);

  // Revenue timeline data
  const timelineData = useMemo(() => {
    const lostByDate = new Map<string, number>();
    const recByDate = new Map<string, number>();
    for (const s of finalSlots) {
      if (s.is_fragment) {
        lostByDate.set(s.slot_date, (lostByDate.get(s.slot_date) ?? 0) + (s.price ?? 0));
      }
    }
    for (const r of appliedRecs) {
      if (r.slot_date < filters.fromDate || r.slot_date > filters.toDate) continue;
      recByDate.set(r.slot_date, (recByDate.get(r.slot_date) ?? 0) + r.estimated_recovered);
    }
    return dates.map((d) => ({
      date: d.slice(5),
      lost: Math.round(lostByDate.get(d) ?? 0),
      recovered: Math.round(recByDate.get(d) ?? 0),
    }));
  }, [finalSlots, appliedRecs, dates, filters.fromDate, filters.toDate]);

  const unitMap = new Map(units.map((u) => [u.id, u.name ?? u.id]));
  const uniqueUnitIds = [...allowedUnits];

  const slotLookup = new Map<string, SlotRow>();
  for (const s of finalSlots) {
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={LayoutGrid} label="Total Slots" value={totalSlots} />
        <KpiCard icon={AlertTriangle} label="Fragmented" value={fragmented} variant="red" />
        <KpiCard icon={DollarSign} label="Revenue at Risk ($)" value={`$${revenueAtRisk.toLocaleString()}`} variant="amber" />
        <KpiCard icon={Lightbulb} label="AI Recommendations" value={totalRecs} variant="green" />
        <KpiCard icon={Users} label="Avg Occupancy %" value={`${avgOccupancy.toFixed(1)}%`} variant="blue" />
      </div>

      {/* Vacant / Booked stat boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox icon={BedDouble} label="Vacant" value={vacantCount} tone="green" />
        <StatBox icon={CheckCircle2} label="Booked" value={bookedCount} tone="gray" />
        <StatBox icon={TrendingDown} label="Under-utilised" value={underUtilized} tone="amber" sub={`-$${Math.round(underRevLoss).toLocaleString()} loss`} />
        <StatBox icon={ShieldAlert} label="Overbooked (Risk)" value={overBooked} tone="red" />
      </div>

      {/* Revenue Recovery Timeline */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-3">Revenue Recovery Over Time</h2>
        {timelineData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in selected range.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="recoveredFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="recovered"
                  name="Recovered"
                  stroke="#10b981"
                  fill="url(#recoveredFill)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="lost"
                  name="Lost"
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
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
  variant?: "red" | "amber" | "green" | "blue";
}) {
  const iconColor =
    variant === "red"
      ? "text-destructive"
      : variant === "amber"
        ? "text-amber-500"
        : variant === "green"
          ? "text-primary"
          : variant === "blue"
            ? "text-blue-500"
            : "text-muted-foreground";

  const valueColor =
    variant === "red"
      ? "text-destructive"
      : variant === "amber"
        ? "text-amber-500"
        : variant === "green"
          ? "text-primary"
          : variant === "blue"
            ? "text-blue-500"
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

  // Color-code by issue_type
  const issue = slot.issue_type;
  const occ = slot.occupancy ?? slot.adult_count ?? 0;
  const cap = slot.capacity ?? 1;
  if (issue === "overbooking" || issue === "critical_mismatch" || occ > cap) {
    return <div className="w-8 h-6 rounded-sm bg-red-600/90" title={`Critical: ${issue ?? "overbooked"}`} />;
  }
  if (issue === "under_utilized" || issue === "underbooking" || issue === "wrong_bed" || (slot.status === "booked" && occ < cap)) {
    return <div className="w-8 h-6 rounded-sm bg-amber-400/80" title={`Under-utilised: ${issue ?? "low occupancy"}`} />;
  }

  if (slot.status === "available") {
    return <div className="w-8 h-6 rounded-sm bg-emerald-500/80" title="Available" />;
  }

  // booked at full capacity = optimal green-700; blocked = gray
  if (slot.status === "booked") {
    return <div className="w-8 h-6 rounded-sm bg-emerald-700/80" title="Optimal booking" />;
  }
  return <div className="w-8 h-6 rounded-sm bg-muted" title={slot.status ?? "blocked"} />;
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "green" | "gray" | "amber" | "red";
  sub?: string;
}) {
  const palette = {
    green: { bg: "bg-emerald-500/15 border-emerald-500/30", icon: "text-emerald-600", val: "text-emerald-700" },
    gray:  { bg: "bg-muted border-border", icon: "text-muted-foreground", val: "text-foreground" },
    amber: { bg: "bg-amber-400/15 border-amber-400/40", icon: "text-amber-600", val: "text-amber-700" },
    red:   { bg: "bg-red-500/15 border-red-500/40", icon: "text-red-600", val: "text-red-700" },
  }[tone];
  return (
    <div className={`rounded-lg border p-4 flex flex-col items-center justify-center text-center ${palette.bg}`}>
      <Icon className={`h-5 w-5 mb-2 ${palette.icon}`} />
      <p className={`text-3xl font-bold ${palette.val}`}>{value}</p>
      <span className="mt-1 text-xs font-medium text-muted-foreground">{label}</span>
      {sub && <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function abbreviate(name: string): string {
  if (name.length <= 10) return name;
  return name.slice(0, 9) + "…";
}
