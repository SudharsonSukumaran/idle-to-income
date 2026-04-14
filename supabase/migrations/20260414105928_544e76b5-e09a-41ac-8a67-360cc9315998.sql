
CREATE TABLE public.inventory_units (
  id text PRIMARY KEY,
  name text,
  category text,
  base_price numeric DEFAULT 0,
  capacity integer DEFAULT 1
);

CREATE TABLE public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text REFERENCES public.inventory_units(id),
  slot_date date,
  status text DEFAULT 'available',
  channel text DEFAULT 'direct',
  price numeric DEFAULT 0,
  source_name text,
  is_fragment boolean DEFAULT false
);

CREATE TABLE public.merge_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text,
  slot_date date,
  source_a_name text,
  source_b_name text,
  source_a_status text,
  source_b_status text,
  resolved_status text,
  resolution_rule text DEFAULT 'booked_wins'
);

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text,
  issue_type text,
  severity text DEFAULT 'medium',
  description text,
  ai_recommendation text,
  estimated_lost_revenue numeric DEFAULT 0,
  estimated_recovered numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at date DEFAULT current_date
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
