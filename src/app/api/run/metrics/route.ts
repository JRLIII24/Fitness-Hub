import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ metrics: data ?? [] });
  } catch (error) {
    console.error("Run metrics GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
