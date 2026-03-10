/**
 * GET /api/runtime-config
 *
 * Returns server-driven configuration values that the client reads on startup
 * to adjust behaviour (maintenance banner, disabled features, etc.).
 *
 * SECURITY: This endpoint is authentication-gated.
 * Without auth, an unauthenticated caller could probe which features are
 * disabled (DISABLED_FEATURES) or whether the app is in maintenance mode
 * (MAINTENANCE_MODE), leaking internal operational state. Requiring a valid
 * session limits this to logged-in users, matching the threat model of the
 * rest of the API surface.
 *
 * If you ever need to expose a *public* maintenance-mode check (e.g. for the
 * login page itself), create a separate unauthenticated endpoint that returns
 * only the single flag needed, not the full config envelope.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  // Initialise the server-side Supabase client (reads cookies from the
  // incoming request headers set by the Edge middleware).
  const supabase = await createClient();

  // Reject unauthenticated callers with 401 before reading any env vars.
  const { response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  return NextResponse.json({
    // true  → show maintenance banner / block writes in the client
    // false → normal operation
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",

    // Comma-separated list of feature slugs the server wants the client to
    // treat as disabled regardless of its own feature-flag state.
    // Example env value: "marketplace,pod_challenges"
    disabledFeatures: process.env.DISABLED_FEATURES
      ? process.env.DISABLED_FEATURES.split(",").map((f) => f.trim())
      : [],
  });
}
