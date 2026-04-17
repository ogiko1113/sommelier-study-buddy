// Client for the user's own wine-master Supabase project.
// Reads VITE_WINE_MASTER_SUPABASE_URL and VITE_WINE_MASTER_SUPABASE_ANON_KEY
// from Workspace Build Secrets (NOT Lovable Cloud's auto-injected client).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_WINE_MASTER_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_WINE_MASTER_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing wine-master Supabase env vars. Set VITE_WINE_MASTER_SUPABASE_URL and VITE_WINE_MASTER_SUPABASE_ANON_KEY in Workspace Settings → Build Secrets."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
