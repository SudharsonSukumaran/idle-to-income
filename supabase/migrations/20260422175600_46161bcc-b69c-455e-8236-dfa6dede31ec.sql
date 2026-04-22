ALTER TABLE public.availability_slots
ADD COLUMN party_size integer NOT NULL DEFAULT 1,
ADD COLUMN adult_count integer NOT NULL DEFAULT 1;