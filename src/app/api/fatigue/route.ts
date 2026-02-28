import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { parsePayload } from "@/lib/validation/parse";
import { fatigueCheckinSchema } from "@/lib/validation/fatigue.schemas";
import { getCachedOrComputeFatigueSnapshot, upsertDailyRecoveryCheckin } from "@/lib/fatigue/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const timezone = request.nextUrl.searchParams.get("timezone") ?? undefined;
    const snapshot = await getCachedOrComputeFatigueSnapshot(user.id, { timezone });
    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("Fatigue GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const raw = await request.json();
    const parsed = parsePayload(fatigueCheckinSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const snapshot = await upsertDailyRecoveryCheckin(user.id, parsed.data, {
      timezone: parsed.data.timezone,
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("Fatigue POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
