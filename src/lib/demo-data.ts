import { supabase } from "@/integrations/supabase/client";

const inventoryUnits = [
  { id: "room-204", name: "Room 204 (Deluxe Double)", category: "room", base_price: 180, capacity: 2, room_type: "Deluxe", bed_type: "double" },
  { id: "room-205", name: "Room 205 (Standard Single)", category: "room", base_price: 140, capacity: 1, room_type: "Standard", bed_type: "single" },
  { id: "room-206", name: "Room 206 (Suite 2X)", category: "room", base_price: 320, capacity: 4, room_type: "Suite", bed_type: "double" },
  { id: "room-207", name: "Room 207 (Family 3X)", category: "room", base_price: 410, capacity: 6, room_type: "3X", bed_type: "double" },
  { id: "room-208", name: "Room 208 (Standard Double)", category: "room", base_price: 195, capacity: 2, room_type: "Standard", bed_type: "double" },
  { id: "spa-slot-a", name: "Spa Slot A", category: "spa_slot", base_price: 80, capacity: 1, room_type: "Standard", bed_type: "single" },
  { id: "table-7", name: "Table 7", category: "table", base_price: 0, capacity: 4, room_type: "Standard", bed_type: "single" },
  { id: "tour-bus-1", name: "Tour Bus 1", category: "tour_seat", base_price: 75, capacity: 40, room_type: "2X", bed_type: "single" },
];

/* ---- Generate intelligent demo slots with new fields ---- */
function genSlots() {
  const dates: string[] = [];
  const start = new Date("2026-04-14T00:00:00");
  for (let i = 0; i < 10; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  type Slot = {
    unit_id: string; slot_date: string; status: string; channel: string;
    price: number; source_name: string; is_fragment: boolean;
    party_size: number; adult_count: number; occupancy: number;
    bed_type: string; room_type: string; capacity: number;
    available_rooms: number; available_shows: number; issue_type: string | null;
  };
  const out: Slot[] = [];

  // Helper
  const make = (
    unit_id: string, date: string, status: string, opts: Partial<Slot> = {},
  ): Slot => {
    const u = inventoryUnits.find((x) => x.id === unit_id)!;
    const occ = opts.occupancy ?? (status === "booked" ? 1 : 0);
    let issue: string | null = null;
    if (status === "booked") {
      if (u.bed_type === "double" && occ === 1) issue = "under_utilized";
      else if (u.bed_type === "single" && occ >= 2) issue = "wrong_bed";
      else if (occ > u.capacity) issue = "overbooking";
      else if (occ < u.capacity && u.capacity > 1) issue = "underbooking";
    }
    return {
      unit_id, slot_date: date, status,
      channel: opts.channel ?? "direct",
      price: opts.price ?? u.base_price,
      source_name: opts.source_name ?? "Meera Excel",
      is_fragment: opts.is_fragment ?? false,
      party_size: occ, adult_count: occ, occupancy: occ,
      bed_type: u.bed_type, room_type: u.room_type, capacity: u.capacity,
      available_rooms: status === "booked" ? 0 : 1,
      available_shows: 0,
      issue_type: opts.issue_type ?? issue,
    };
  };

  // Room 204 (Deluxe double, cap 2): mostly booked w/ 1 guest = under_utilized
  for (const d of dates) {
    const r = Math.random();
    if (r < 0.6) out.push(make("room-204", d, "booked", { occupancy: 1, channel: "booking.com" }));
    else out.push(make("room-204", d, "available"));
  }
  // Room 205 (Standard single, cap 1): one date with couple = wrong_bed (critical)
  dates.forEach((d, i) => {
    if (i === 2) out.push(make("room-205", d, "booked", { occupancy: 2, issue_type: "critical_mismatch" }));
    else if (i % 3 === 0) out.push(make("room-205", d, "booked", { occupancy: 1 }));
    else out.push(make("room-205", d, "available"));
  });
  // Room 206 (Suite cap 4): underbooking when only 2 stay
  dates.forEach((d, i) => {
    if (i % 2 === 0) out.push(make("room-206", d, "booked", { occupancy: 2 }));
    else out.push(make("room-206", d, "available"));
  });
  // Room 207 (3X cap 6): heavy underbooking — only 1 person
  dates.forEach((d, i) => {
    if (i < 4) out.push(make("room-207", d, "booked", { occupancy: 1 }));
    else out.push(make("room-207", d, "available"));
  });
  // Room 208 (Standard double, cap 2): one overbooking
  dates.forEach((d, i) => {
    if (i === 5) out.push(make("room-208", d, "booked", { occupancy: 3, issue_type: "overbooking" }));
    else if (i % 2 === 1) out.push(make("room-208", d, "booked", { occupancy: 2 }));
    else out.push(make("room-208", d, "available"));
  });
  // Spa & Table & Tour bus
  for (const d of dates) out.push(make("spa-slot-a", d, Math.random() < 0.5 ? "booked" : "available"));
  for (const d of dates) out.push(make("table-7", d, "available"));
  for (const d of dates.slice(0, 6)) out.push(make("tour-bus-1", d, "booked", { occupancy: 8 }));

  // Cross-source duplicate (Ravi DB) for merge_conflicts demo
  out.push(make("room-204", dates[0], "blocked", { source_name: "Ravi DB", channel: "maintenance" }));
  return out;
}

const availabilitySlots = genSlots();

export async function loadDemoData() {
  // Clear dependent tables first (order matters due to FK)
  const { error: e1 } = await supabase.from("recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("merge_conflicts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) throw e2;

  const { error: e3 } = await supabase.from("availability_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e3) throw e3;

  const { error: e4 } = await supabase.from("inventory_units").delete().neq("id", "");
  if (e4) throw e4;

  // Insert inventory units
  const { error: e5 } = await supabase.from("inventory_units").upsert(inventoryUnits);
  if (e5) throw e5;

  // Insert availability slots
  const { error: e6 } = await supabase.from("availability_slots").insert(availabilitySlots);
  if (e6) throw e6;
}
