import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lvuspqkfhulbhgbryyvs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dXNwcWtmaHVsYmhnYnJ5eXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTI4OTQsImV4cCI6MjA5MTcyODg5NH0._U7UVzHo84-LwELamIGclRixgmbAEtDmDa9c07vreBA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
