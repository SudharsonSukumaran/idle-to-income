import { supabase } from "@/integrations/supabase/client";

interface SlotRow {
  id: string;
  unit_id: string;
  slot_date: string;
  status: string;
  price: number;
  party_size?: number;
}

interface ConflictRow {
  unit_id: string;
  slot_date: string;
  source_a_name: string;
  source_b_name: string;
  source_a_status: string;
  source_b_status: string;
}

interface UnitRow {
  id: string;
  capacity: number;
  room_type?: string;
  base_price?: number;
}

interface NewRec {
  unit_id: string;
  issue_type: string;
  severity: string;
  description: string;
  estimated_lost_revenue: number;
  estimated_recovered: number;
}

export async function detectFragmentation(): Promise<number> {
  // Step 1 — fetch all slots
  const { data: slotsRaw, error: sErr } = await supabase
    .from("availability_slots")
    .select("id, unit_id, slot_date, status, price, party_size")
    .order("unit_id")
    .order("slot_date");
  if (sErr) throw sErr;
  const slots = (slotsRaw as SlotRow[]) ?? [];

  // Step 2 — group by unit_id
  const unitGroups = new Map<string, SlotRow[]>();
  for (const s of slots) {
    if (!unitGroups.has(s.unit_id)) unitGroups.set(s.unit_id, []);
    unitGroups.get(s.unit_id)!.push(s);
  }

  // Step 3 — sort each group by date
  for (const [, group] of unitGroups) {
    group.sort((a, b) => a.slot_date.localeCompare(b.slot_date));
  }

  const newRecs: NewRec[] = [];
  const fragmentIds: string[] = [];

  // Pattern 1 — Orphan night
  for (const [, group] of unitGroups) {
    for (let i = 1; i < group.length - 1; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      const next = group[i + 1];

      const prevBlocked = prev.status === "booked" || prev.status === "blocked";
      const nextBlocked = next.status === "booked" || next.status === "blocked";

      if (prevBlocked && curr.status === "available" && nextBlocked) {
        fragmentIds.push(curr.id);
        newRecs.push({
          unit_id: curr.unit_id,
          issue_type: "orphan_night",
          severity: "high",
          description: `${curr.unit_id} has orphan date ${curr.slot_date}`,
          estimated_lost_revenue: curr.price ?? 0,
          estimated_recovered: (curr.price ?? 0) * 0.9,
        });
      }
    }
  }

  // Pattern 2 — Sub-threshold (tour units)
  const { data: unitsRaw } = await supabase.from("inventory_units").select("id, capacity, room_type, base_price");
  const unitsList = (unitsRaw as UnitRow[]) ?? [];
  const unitsMap = new Map(unitsList.map((u) => [u.id, u.capacity]));
  const unitInfoMap = new Map(unitsList.map((u) => [u.id, u]));

  for (const [unitId, group] of unitGroups) {
    if (!unitId.includes("tour")) continue;
    const bookedCount = group.filter((s) => s.status === "booked").length;
    const capacity = unitsMap.get(unitId) ?? 0;
    if (capacity > 0 && bookedCount < capacity) {
      newRecs.push({
        unit_id: unitId,
        issue_type: "sub_threshold",
        severity: "high",
        description: `${unitId} has ${bookedCount} bookings across all dates, needs ${capacity} minimum.`,
        estimated_lost_revenue: bookedCount * 75,
        estimated_recovered: bookedCount * 60,
      });
    }
  }

  // Pattern 3 — Channel mismatch
  const { data: conflictsRaw } = await supabase.from("merge_conflicts").select("unit_id, slot_date, source_a_name, source_b_name, source_a_status, source_b_status");
  const conflicts = (conflictsRaw as ConflictRow[]) ?? [];

  for (const c of conflicts) {
    if (c.source_a_status === "available" && c.source_b_status === "blocked") {
      newRecs.push({
        unit_id: c.unit_id,
        issue_type: "channel_mismatch",
        severity: "medium",
        description: `${c.unit_id} on ${c.slot_date}: ${c.source_a_name} says available, ${c.source_b_name} says blocked.`,
        estimated_lost_revenue: 150,
        estimated_recovered: 130,
      });
    }
  }

  // Pattern 4 — Overbooking (same unit + date with 2+ booked rows)
  const overbookMap = new Map<string, SlotRow[]>();
  for (const s of slots) {
    if (s.status !== "booked") continue;
    const key = `${s.unit_id}|${s.slot_date}`;
    if (!overbookMap.has(key)) overbookMap.set(key, []);
    overbookMap.get(key)!.push(s);
  }
  for (const [, group] of overbookMap) {
    if (group.length >= 2) {
      const s = group[0];
      newRecs.push({
        unit_id: s.unit_id,
        issue_type: "overbooking",
        severity: "high",
        description: `${s.unit_id} is double-booked on ${s.slot_date} — two confirmed reservations for the same slot.`,
        estimated_lost_revenue: (s.price ?? 0) * 2,
        estimated_recovered: 0,
      });
    }
  }

  // Pattern 5 — Room misallocation (party_size = 1 in a double_bed)
  // Average price by room_type for delta calculation
  const priceByType = new Map<string, number[]>();
  for (const s of slots) {
    const u = unitInfoMap.get(s.unit_id);
    if (!u?.room_type) continue;
    if (!priceByType.has(u.room_type)) priceByType.set(u.room_type, []);
    priceByType.get(u.room_type)!.push(s.price ?? 0);
  }
  const avgByType = new Map<string, number>();
  for (const [t, arr] of priceByType) {
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    avgByType.set(t, avg);
  }
  for (const s of slots) {
    const u = unitInfoMap.get(s.unit_id);
    if (!u || u.room_type !== "double_bed") continue;
    if ((s.party_size ?? 1) !== 1) continue;
    const doublePrice = avgByType.get("double_bed") ?? (s.price ?? 0);
    const singlePrice = avgByType.get("single_cot") ?? doublePrice;
    const delta = Math.max(0, doublePrice - singlePrice);
    newRecs.push({
      unit_id: s.unit_id,
      issue_type: "room_misallocation",
      severity: "medium",
      description: `${s.unit_id} is a double_bed room allocated to a single guest — recommend swap to single_cot.`,
      estimated_lost_revenue: delta,
      estimated_recovered: delta,
    });
  }

  // Pattern 6 — Underutilised (booked/total < 50% per unit over selected period)
  for (const [unitId, group] of unitGroups) {
    const totalDays = group.length;
    if (totalDays === 0) continue;
    const bookedDays = group.filter((s) => s.status === "booked").length;
    const ratio = bookedDays / totalDays;
    if (ratio < 0.5) {
      const pct = Math.round(ratio * 100);
      const avgPrice =
        group.reduce((sum, s) => sum + (s.price ?? 0), 0) / totalDays;
      const lost = (totalDays - bookedDays) * avgPrice;
      newRecs.push({
        unit_id: unitId,
        issue_type: "underutilised",
        severity: "low",
        description: `${unitId} is only ${pct}% utilised over the selected period — consider promotional pricing or package bundling.`,
        estimated_lost_revenue: lost,
        estimated_recovered: lost * 0.6,
      });
    }
  }

  // Update fragment flags
  for (const id of fragmentIds) {
    await supabase.from("availability_slots").update({ is_fragment: true }).eq("id", id);
  }

  // Insert recommendations
  if (newRecs.length > 0) {
    const { error: insErr } = await supabase.from("recommendations").insert(newRecs);
    if (insErr) throw insErr;
  }

  return newRecs.length;
}
