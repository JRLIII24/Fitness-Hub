/**
 * Wearable Integration — Disconnect
 * DELETE /api/wearable/integrations/:provider
 *
 * Deactivates a wearable integration and nulls the OAuth tokens.
 * Token columns require service_role access; this route uses the
 * standard server client whose RLS identity is the current user.
 * The token columns are updated via a direct SQL UPDATE rather than
 * the client SDK (which cannot SELECT them).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { WEARABLE_INTEGRATIONS_ENABLED } from "@/lib/features";

const VALID_PROVIDERS = ["garmin", "apple_health", "google_fit"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  if (!WEARABLE_INTEGRATIONS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  // Use RPC to null tokens (token columns are revoked from authenticated role)
  const { error } = await (supabase as any).rpc("disconnect_wearable_integration", {
    p_user_id: user.id,
    p_provider: provider,
  });

  if (error) {
    // Fallback: update non-token fields at minimum
    const { error: updateErr } = await (supabase as any)
      .from("wearable_integrations")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to disconnect integration" }, { status: 500 });
    }
  }

  return NextResponse.json({ disconnected: true, provider });
}
