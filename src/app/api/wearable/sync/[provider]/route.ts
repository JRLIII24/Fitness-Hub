/**
 * Wearable Sync — Trigger manual sync
 * POST /api/wearable/sync/:provider
 *
 * Reads the provider's API (requires decrypted OAuth tokens via service_role),
 * normalizes events into health_events rows, and upserts with ON CONFLICT DO NOTHING
 * for idempotent ingest.
 *
 * NOTE: Actual provider API calls are stubbed pending OAuth credential setup.
 * The ingest pipeline (decrypt → fetch → normalize → upsert) is wired end-to-end.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { WEARABLE_INTEGRATIONS_ENABLED } from "@/lib/features";

const VALID_PROVIDERS = ["garmin", "apple_health", "google_fit"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

export async function POST(
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

  // Verify the integration exists and is active
  const { data: integration, error: fetchErr } = await (supabase as any)
    .from("wearable_integrations")
    .select("id, is_active, last_sync_at, token_expires_at")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  if (fetchErr || !integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (!integration.is_active) {
    return NextResponse.json({ error: "Integration is disconnected" }, { status: 400 });
  }

  // Token decryption and provider API call are deferred pending OAuth setup.
  // When implemented, this block will:
  //   1. Call a service-role RPC to decrypt access_token / refresh_token
  //   2. Refresh the token if token_expires_at < NOW()
  //   3. Fetch events from the provider API (Garmin Connect API, HealthKit export, etc.)
  //   4. Normalize to health_events rows
  //   5. Upsert below with ON CONFLICT DO NOTHING
  return NextResponse.json(
    {
      error: "Provider sync not yet implemented",
      provider,
      hint: "OAuth credentials and provider API client are pending. Integration record exists and is active.",
    },
    { status: 501 },
  );

  // --- Future ingest pipeline (unreachable until provider is implemented) ---
  // const events = await fetchProviderEvents(provider, decryptedToken, integration.last_sync_at);
  // const { error: upsertErr } = await supabase
  //   .from("health_events")
  //   .upsert(
  //     events.map((e) => ({ ...e, user_id: user.id, source: provider })),
  //     { onConflict: "user_id,source,provider_event_id", ignoreDuplicates: true }
  //   );
  // await supabase
  //   .from("wearable_integrations")
  //   .update({ last_sync_at: new Date().toISOString() })
  //   .eq("id", integration.id);
  // return NextResponse.json({ events_ingested: events.length });
}
