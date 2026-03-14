import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { HEALTHKIT_SYNC_ENABLED } from "@/lib/features";
import { getUserTimezone, getDateInTimezone } from "@/lib/timezone";
import { logger } from "@/lib/logger";

const VALID_SOURCES = new Set(["healthkit", "google_fit", "manual"]);

export async function POST(request: NextRequest) {
  try {
    if (!HEALTHKIT_SYNC_ENABLED) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();

    // Validate source
    if (!body.source || !VALID_SOURCES.has(body.source)) {
      return NextResponse.json(
        { error: "Invalid source. Must be one of: healthkit, google_fit, manual" },
        { status: 400 }
      );
    }

    // Validate optional numeric fields
    if (body.sleep_hours != null && (typeof body.sleep_hours !== "number" || body.sleep_hours < 0 || body.sleep_hours > 24)) {
      return NextResponse.json({ error: "sleep_hours must be 0-24" }, { status: 400 });
    }
    if (body.resting_heart_rate != null && (typeof body.resting_heart_rate !== "number" || body.resting_heart_rate < 20 || body.resting_heart_rate > 250)) {
      return NextResponse.json({ error: "resting_heart_rate must be 20-250" }, { status: 400 });
    }
    if (body.hrv_ms != null && (typeof body.hrv_ms !== "number" || body.hrv_ms < 0 || body.hrv_ms > 300)) {
      return NextResponse.json({ error: "hrv_ms must be 0-300" }, { status: 400 });
    }
    if (body.steps != null && (typeof body.steps !== "number" || body.steps < 0)) {
      return NextResponse.json({ error: "steps must be non-negative" }, { status: 400 });
    }

    const timezone = await getUserTimezone(user.id);
    const today = getDateInTimezone(new Date(), timezone);

    const { error } = await supabase.from("health_sync_data").upsert(
      {
        user_id: user.id,
        sync_date: today,
        sleep_hours: body.sleep_hours ?? null,
        resting_heart_rate: body.resting_heart_rate ?? null,
        hrv_ms: body.hrv_ms ?? null,
        steps: body.steps ?? null,
        source: body.source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,sync_date,source" }
    );

    if (error) {
      logger.error("Health sync upsert error:", error);
      return NextResponse.json({ error: "Failed to save health data" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Health sync POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
