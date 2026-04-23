-- availability_slots: new intelligence fields
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS bed_type text DEFAULT 'double',
  ADD COLUMN IF NOT EXISTS occupancy integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS available_rooms integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS available_shows integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_type text DEFAULT 'Standard',
  ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS fragment_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issue_type text;

-- inventory_units: bed_type default
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS bed_type text DEFAULT 'double';

-- Backfill room_type on availability_slots from inventory_units where empty
UPDATE public.availability_slots a
SET room_type = COALESCE(NULLIF(a.room_type, ''), u.room_type, 'Standard'),
    capacity = COALESCE(a.capacity, u.capacity, 2),
    bed_type = COALESCE(NULLIF(a.bed_type, ''), u.bed_type, 'double')
FROM public.inventory_units u
WHERE a.unit_id = u.id;
