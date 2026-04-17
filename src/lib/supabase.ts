// Client for the user's own wine-master Supabase project.
// Anon key is safe to embed publicly when RLS is configured on the target project.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://plgltbbrvngf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxscm5ubW14cGxnbHRiYnJ2bmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODk1MjcsImV4cCI6MjA5MTk2NTUyN30.QK4eg6U0rv3eh6gGwr0JtwD8muH3bZPxxOC4XrpkEx4";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
