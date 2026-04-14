import { supabase } from "@/integrations/supabase/client";

const inventoryUnits = [
  { id: "room-204", name: "Room 204", category: "room", base_price: 180, capacity: 1 },
  { id: "room-205", name: "Room 205", category: "room", base_price: 195, capacity: 1 },
  { id: "room-206", name: "Room 206", category: "room", base_price: 210, capacity: 1 },
  { id: "spa-slot-a", name: "Spa Slot A", category: "spa_slot", base_price: 80, capacity: 1 },
  { id: "table-7", name: "Table 7", category: "table", base_price: 0, capacity: 4 },
  { id: "tour-bus-1", name: "Tour Bus 1", category: "tour_seat", base_price: 75, capacity: 40 },
];

const availabilitySlots = [
  { unit_id: "room-204", slot_date: "2026-04-14", status: "booked", channel: "booking.com", price: 180, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-204", slot_date: "2026-04-15", status: "available", channel: "direct", price: 180, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-204", slot_date: "2026-04-16", status: "available", channel: "direct", price: 180, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-204", slot_date: "2026-04-17", status: "booked", channel: "expedia", price: 180, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-205", slot_date: "2026-04-14", status: "available", channel: "direct", price: 195, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-205", slot_date: "2026-04-15", status: "available", channel: "direct", price: 195, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-206", slot_date: "2026-04-14", status: "booked", channel: "direct", price: 210, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "room-206", slot_date: "2026-04-15", status: "available", channel: "direct", price: 210, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "spa-slot-a", slot_date: "2026-04-14", status: "booked", channel: "direct", price: 80, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "spa-slot-a", slot_date: "2026-04-15", status: "available", channel: "direct", price: 80, source_name: "Meera Excel", is_fragment: false },
  { unit_id: "spa-slot-a", slot_date: "2026-04-16", status: "booked", channel: "direct", price: 80, source_name: "Meera Excel", is_fragment: false },
  // Ravi DB source
  { unit_id: "room-204", slot_date: "2026-04-14", status: "booked", channel: "booking.com", price: 180, source_name: "Ravi DB", is_fragment: false },
  { unit_id: "room-204", slot_date: "2026-04-16", status: "blocked", channel: "maintenance", price: 180, source_name: "Ravi DB", is_fragment: false },
  { unit_id: "tour-bus-1", slot_date: "2026-04-20", status: "booked", channel: "direct", price: 75, source_name: "Ravi DB", is_fragment: false },
  { unit_id: "tour-bus-1", slot_date: "2026-04-21", status: "booked", channel: "direct", price: 75, source_name: "Ravi DB", is_fragment: false },
  { unit_id: "tour-bus-1", slot_date: "2026-04-22", status: "booked", channel: "direct", price: 75, source_name: "Ravi DB", is_fragment: false },
  { unit_id: "tour-bus-1", slot_date: "2026-04-23", status: "booked", channel: "direct", price: 75, source_name: "Ravi DB", is_fragment: false },
];

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
