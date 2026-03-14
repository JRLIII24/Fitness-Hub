/**
 * Public Leaderboard API
 * GET /api/social/leaderboard
 *
 * Returns a ranked list of public users by training metric.
 *
 * Query params:
 *   metric  — volume | consistency | streak  (default: volume)
 *   period  — weekly | monthly | all_time    (default: weekly)
 *   limit   — 1-100                          (default: 50)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { SOCIAL_FEED_ENABLED } from "@/lib/features";
import { logger } from "@/lib/logger";

const QuerySchema = z.object({
  metric: z.enum(["volume", "consistency", "streak"]).default("volume"),
  period: z.enum(["weekly", "monthly", "all_time"]).default("weekly"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  if (!SOCIAL_FEED_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  // Silence unused variable warning — auth is required for the RPC
  void user;

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { metric, period, limit } = parsed.data;

  const { data, error } = await (supabase as any).rpc("get_public_leaderboard", {
    p_metric: metric,
    p_period: period,
    p_limit: limit,
  });

  if (error) {
    logger.error("Leaderboard RPC error:", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }

  return NextResponse.json({ leaderboard: data ?? [], metric, period });
}
