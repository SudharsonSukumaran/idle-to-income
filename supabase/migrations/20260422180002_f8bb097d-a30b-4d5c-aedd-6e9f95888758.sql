ALTER TABLE public.inventory_units
ADD COLUMN room_type text NOT NULL DEFAULT 'double_bed';

UPDATE public.inventory_units SET room_type = 'double_bed' WHERE id = 'room-204';
UPDATE public.inventory_units SET room_type = 'single_cot' WHERE id = 'room-205';
UPDATE public.inventory_units SET room_type = 'suite'      WHERE id = 'room-206';
UPDATE public.inventory_units SET room_type = 'spa'        WHERE id = 'spa-slot-a';
UPDATE public.inventory_units SET room_type = 'group'      WHERE id = 'tour-bus-1';