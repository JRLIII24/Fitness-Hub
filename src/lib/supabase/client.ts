import { createBrowserClient } from "@supabase/ssr";
// Note: Database type imported for reference. When Supabase project is connected,
// regenerate with `supabase gen types typescript --db-only` to match @supabase/ssr v0.8.0 format
import type { Database } from "@/types/database";

export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
