import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { READINESS_SCORE_ENABLED } from "@/lib/features";
import { getCachedOrComputeReadiness } from "@/lib/readiness/server";

export async function GET() {
  try {
    if (!READINESS_SCORE_ENABLED) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const readiness = await getCachedOrComputeReadiness(user.id);
    return NextResponse.json({ readiness });
  } catch (error) {
    console.error("Readiness GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
