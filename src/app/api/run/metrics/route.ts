import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { RUN_FEATURE_ENABLED } from "@/lib/features";

export async function GET(request: NextRequest) {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const weeks = parseInt(
      request.nextUrl.searchParams.get("weeks") ?? "12",
      10
    );

    const { data, error } = await supabase
      .from("run_metrics")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start_date", { ascending: false })
      .limit(weeks);

    if (error) {
      console.error("Run metrics GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { metrics: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Run metrics GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
