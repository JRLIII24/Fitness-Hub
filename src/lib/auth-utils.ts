import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function requireAuth(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}
