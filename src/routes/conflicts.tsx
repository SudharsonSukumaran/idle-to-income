import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { GitMerge, Loader2, RefreshCw, Search, Info, AlertTriangle, TrendingDown, ShieldAlert, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectFragmentation } from "@/lib/detect-fragmentation";

export const Route = createFileRoute("/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts — Idle2Income" },
      { name: "description", content: "Detect and resolve merge conflicts across data sources." },
    ],
  }),
  component: ConflictsPage,
});

interface ConflictRow {
  id: string;
  unit_id: string;
  slot_date: string;
  source_a_name: string;
  source_b_name: string;
  source_a_status: string;
  source_b_status: string;
  resolved_status: string;
  resolution_rule: string;
}

interface SlotRow {
  id: string;
  unit_id: string;
  slot_date: string;
  status: string;
  source_name: string;
}

interface IssueSlotRow {
  id: string;
  unit_id: string;
  slot_date: string;
  status: string;
  is_fragment: boolean;
  issue_type: string | null;
  occupancy: number | null;
  capacity: number | null;
  bed_type: string | null;
  room_type: string | null;
  price: number | null;
  adult_count: number | null;
}

type ConflictTab = "all" | "fragmentation" | "underbooking" | "overbooking" | "wrong";

const TAB_DEFS: { id: ConflictTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "all", label: "All", icon: GitMerge, color: "text-foreground" },
  { id: "fragmentation", label: "Fragmentation", icon: AlertTriangle, color: "text-red-600" },
  { id: "underbooking", label: "Underbooking", icon: TrendingDown, color: "text-amber-600" },
  { id: "overbooking", label: "Overbooking", icon: ShieldAlert, color: "text-red-700" },
  { id: "wrong", label: "Wrong allocation", icon: ArrowLeftRight, color: "text-orange-600" },
];

function ConflictsPage() {
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [issueSlots, setIssueSlots] = useState<IssueSlotRow[]>([]);
  const [tab, setTab] = useState<ConflictTab>("all");
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    const [mcRes, slotRes] = await Promise.all([
      supabase.from("merge_conflicts").select("*").order("slot_date", { ascending: true }),
      supabase
        .from("availability_slots")
        .select("id, unit_id, slot_date, status, is_fragment, issue_type, occupancy, capacity, bed_type, room_type, price, adult_count")
        .order("slot_date", { ascending: true }),
    ]);
    setConflicts((mcRes.data as ConflictRow[]) ?? []);
    setIssueSlots(((slotRes.data as IssueSlotRow[]) ?? []).filter(rowHasIssue));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleRunMerge = async () => {
    setMerging(true);
    try {
      // 1. Fetch all slots
      const { data: slots, error: fetchErr } = await supabase
        .from("availability_slots")
        .select("id, unit_id, slot_date, status, source_name")
        .order("unit_id")
        .order("slot_date");
      if (fetchErr) throw fetchErr;

      const allSlots = (slots as SlotRow[]) ?? [];

      // 2. Group by unit_id + slot_date
      const groups = new Map<string, SlotRow[]>();
      for (const s of allSlots) {
        const key = `${s.unit_id}|${s.slot_date}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(s);
      }

      // 3-6. Process conflicted groups
      let resolvedCount = 0;
      const newConflicts: Array<{
        unit_id: string;
        slot_date: string;
        source_a_name: string;
        source_b_name: string;
        source_a_status: string;
        source_b_status: string;
        resolved_status: string;
        resolution_rule: string;
      }> = [];
      const updateOps: Array<{ id: string; status: string }> = [];
      const deleteIds: string[] = [];

      for (const [, group] of groups) {
        if (group.length < 2) continue;

        // Resolve
        let resolved = "available";
        if (group.some((r) => r.status === "blocked")) resolved = "blocked";
        else if (group.some((r) => r.status === "booked")) resolved = "booked";

        newConflicts.push({
          unit_id: group[0].unit_id,
          slot_date: group[0].slot_date,
          source_a_name: group[0].source_name ?? "",
          source_b_name: group[1].source_name ?? "",
          source_a_status: group[0].status,
          source_b_status: group[1].status,
          resolved_status: resolved,
          resolution_rule: "booked_wins",
        });

        // Keep first, update it
        updateOps.push({ id: group[0].id, status: resolved });

        // Delete duplicates
        for (let i = 1; i < group.length; i++) {
          deleteIds.push(group[i].id);
        }

        resolvedCount++;
      }

      // Clear old conflicts
      await supabase.from("merge_conflicts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert new conflicts
      if (newConflicts.length > 0) {
        const { error: insErr } = await supabase.from("merge_conflicts").insert(newConflicts);
        if (insErr) throw insErr;
      }

      // Update kept rows
      for (const op of updateOps) {
        const { error } = await supabase.from("availability_slots").update({ status: op.status }).eq("id", op.id);
        if (error) throw error;
      }

      // Delete duplicates
      if (deleteIds.length > 0) {
        for (let i = 0; i < deleteIds.length; i += 50) {
          const batch = deleteIds.slice(i, i + 50);
          const { error } = await supabase.from("availability_slots").delete().in("id", batch);
          if (error) throw error;
        }
      }

      toast.success(`${resolvedCount} conflict${resolvedCount !== 1 ? "s" : ""} resolved.`);
      await fetchConflicts();
    } catch (err: any) {
      toast.error(err.message ?? "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  // Compute per-tab counts
  const counts = {
    fragmentation: issueSlots.filter((r) => isFragmentationRow(r)).length,
    underbooking: issueSlots.filter((r) => isUnderRow(r)).length,
    overbooking: issueSlots.filter((r) => isOverRow(r)).length,
    wrong: issueSlots.filter((r) => isWrongAllocRow(r)).length,
  };
  const allCount = counts.fragmentation + counts.underbooking + counts.overbooking + counts.wrong + conflicts.length;

  const visibleIssues = issueSlots.filter((r) => {
    if (tab === "all") return true;
    if (tab === "fragmentation") return isFragmentationRow(r);
    if (tab === "underbooking") return isUnderRow(r);
    if (tab === "overbooking") return isOverRow(r);
    if (tab === "wrong") return isWrongAllocRow(r);
    return false;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conflicts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detect and resolve data conflicts and booking-quality issues across sources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setDetecting(true);
              try {
                const count = await detectFragmentation();
                toast.success(`Fragmentation detection complete. ${count} issues found.`);
                await fetchConflicts();
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
            onClick={fetchConflicts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Post-MVP note */}
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
        <Info className="h-4 w-4 text-primary shrink-0" />
        Advanced conflict detection will be enhanced post-MVP.
      </div>

      {/* Issue-type tabs */}
      <div className="flex flex-wrap gap-2">
        {TAB_DEFS.map((t) => {
          const count =
            t.id === "all"
              ? allCount
              : counts[t.id as Exclude<ConflictTab, "all">];
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card text-foreground hover:bg-accent/10"
              }`}
            >
              <t.icon className={`h-3.5 w-3.5 ${active ? "" : t.color}`} />
              {t.label}
              <span className={`ml-1 rounded-full px-1.5 py-0 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary bar + merge button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <GitMerge className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">
            {loading ? "Loading…" : `${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} detected`}
          </span>
        </div>
        <button
          onClick={handleRunMerge}
          disabled={merging}
          className="inline-flex items-center gap-2 rounded-md bg-[oklch(0.55_0.18_290)] px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.50_0.18_290)] disabled:opacity-50"
        >
          {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
          {merging ? "Merging…" : "Run Merge"}
        </button>
      </div>

      {/* Source-merge conflicts table — visible on All tab */}
      {(tab === "all") && (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30">
          Source merge conflicts
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Unit</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Source A</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Source B</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Resolved</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Rule</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No conflicts. Click "Run Merge" to detect conflicts across sources.
                  </td>
                </tr>
              ) : (
                conflicts.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-0 ${
                      c.resolved_status === "blocked" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-card-foreground">{c.unit_id}</td>
                    <td className="py-2.5 px-4 text-card-foreground">{c.slot_date}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-card-foreground">{c.source_a_name}</span>
                      <StatusBadge status={c.source_a_status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-card-foreground">{c.source_b_name}</span>
                      <StatusBadge status={c.source_b_status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={c.resolved_status} />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{c.resolution_rule}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Issue table (filtered by selected tab) */}
      {tab !== "all" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30">
            {TAB_DEFS.find((t) => t.id === tab)?.label} issues
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Occupancy</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Bed / Room</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Issue</th>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No {TAB_DEFS.find((t) => t.id === tab)?.label.toLowerCase()} issues detected.
                    </td>
                  </tr>
                ) : (
                  visibleIssues.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-4 font-medium text-card-foreground">{r.unit_id}</td>
                      <td className="py-2.5 px-4 text-card-foreground">{r.slot_date}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={r.status} /></td>
                      <td className="py-2.5 px-4 text-card-foreground">
                        {(r.occupancy ?? r.adult_count ?? 0)} / {r.capacity ?? "?"}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {r.bed_type ?? "—"}{r.room_type ? ` · ${r.room_type}` : ""}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <IssueBadge tab={tab} row={r} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function rowHasIssue(r: IssueSlotRow): boolean {
  return isFragmentationRow(r) || isUnderRow(r) || isOverRow(r) || isWrongAllocRow(r);
}
function isFragmentationRow(r: IssueSlotRow): boolean {
  return !!r.is_fragment || r.issue_type === "fragment" || r.issue_type === "orphan_night";
}
function isUnderRow(r: IssueSlotRow): boolean {
  if (r.issue_type === "under_utilized" || r.issue_type === "underbooking" || r.issue_type === "sub_threshold") return true;
  const occ = r.occupancy ?? r.adult_count ?? 0;
  const cap = r.capacity ?? 0;
  return r.status === "booked" && cap > 0 && occ > 0 && occ < cap;
}
function isOverRow(r: IssueSlotRow): boolean {
  if (r.issue_type === "overbooking" || r.issue_type === "critical_mismatch") return true;
  const occ = r.occupancy ?? r.adult_count ?? 0;
  const cap = r.capacity ?? 0;
  return cap > 0 && occ > cap;
}
function isWrongAllocRow(r: IssueSlotRow): boolean {
  return r.issue_type === "wrong_bed" || r.issue_type === "room_misallocation" || r.issue_type === "channel_mismatch";
}

function IssueBadge({ tab, row }: { tab: ConflictTab; row: IssueSlotRow }) {
  const label = row.issue_type ?? (tab === "fragmentation" ? "fragment" : tab);
  const cls =
    tab === "fragmentation"
      ? "bg-red-500/10 text-red-700"
      : tab === "underbooking"
        ? "bg-amber-500/10 text-amber-700"
        : tab === "overbooking"
          ? "bg-red-700/10 text-red-800"
          : "bg-orange-500/10 text-orange-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  let cls = "ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ";
  switch (status) {
    case "available":
      cls += "bg-primary/10 text-primary";
      break;
    case "booked":
      cls += "bg-muted text-muted-foreground";
      break;
    case "blocked":
      cls += "bg-destructive/10 text-destructive";
      break;
    default:
      cls += "bg-muted text-muted-foreground";
  }
  return <span className={cls}>{status}</span>;
}
