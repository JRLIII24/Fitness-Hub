/**
 * Wearable Integrations — List
 * GET /api/wearable/integrations
 *
 * Returns all wearable integrations for the current user.
 * Token columns (access_token, refresh_token) are revoked from the
 * authenticated role at the DB level and are never returned here.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { WEARABLE_INTEGRATIONS_ENABLED } from "@/lib/features";

export async function GET() {
  if (!WEARABLE_INTEGRATIONS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  const { data, error } = await (supabase as any)
    .from("wearable_integrations")
    .select("id, provider, scopes, provider_user_id, last_sync_at, is_active, token_expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 });
  }

  return NextResponse.json({ integrations: data ?? [] });
}
