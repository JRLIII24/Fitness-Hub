import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to get a memoized Supabase browser client.
 * Prevents creating a new client on every render.
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}
