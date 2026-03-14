import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { parsePayload } from "@/lib/validation/parse";
import { fatigueSessionRpeSchema } from "@/lib/validation/fatigue.schemas";
import { saveSessionRpeAndRecompute } from "@/lib/fatigue/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const raw = await request.json();
    const parsed = parsePayload(fatigueSessionRpeSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const snapshot = await saveSessionRpeAndRecompute(
      user.id,
      parsed.data.session_id,
      parsed.data.session_rpe,
      { timezone: parsed.data.timezone }
    );

    return NextResponse.json({ snapshot });
  } catch (error) {
    logger.error("Session RPE POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
