import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePayload } from "@/lib/validation/parse";
import { fatigueSessionRpeSchema } from "@/lib/validation/fatigue.schemas";
import { saveSessionRpeAndRecompute } from "@/lib/fatigue/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("Session RPE POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
