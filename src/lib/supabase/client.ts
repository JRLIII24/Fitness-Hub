import { createBrowserClient } from "@supabase/ssr";

// To enable full type safety, link your Supabase project and run:
//   pnpm gen:types
// Then replace <any> with <Database> from "@/types/database"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
