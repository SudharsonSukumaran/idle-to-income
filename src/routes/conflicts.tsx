import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { GitMerge, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

function ConflictsPage() {
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merge_conflicts")
      .select("*")
      .order("slot_date", { ascending: true });
    setConflicts((data as ConflictRow[]) ?? []);
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conflicts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detect and resolve data conflicts across sources.
          </p>
        </div>
        <button
          onClick={fetchConflicts}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
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

      {/* Conflicts table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
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
    </div>
  );
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
