import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";
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

    const timezone =
      request.nextUrl.searchParams.get("timezone") ?? undefined;

    // Fetch fatigue snapshot. Keep run readiness resilient even if fatigue tables are not migrated yet.
    let snapshot:
      | Awaited<ReturnType<typeof getCachedOrComputeFatigueSnapshot>>
      | null = null;
    try {
      snapshot = await getCachedOrComputeFatigueSnapshot(user.id, {
        timezone,
      });
    } catch (error) {
      console.warn("Run readiness fatigue snapshot unavailable:", error);
      snapshot = null;
    }

    // Fetch last run
    const { data: lastRun } = await supabase
      .from("run_sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch last lift
    const { data: lastLift } = await supabase
      .from("workout_sessions")
      .select("started_at, notes")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("notes", "like", "run:%")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Weekly run stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const { data: weekRuns } = await supabase
      .from("run_sessions")
      .select("distance_meters")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", weekStart.toISOString());

    const now = Date.now();
    const dayMs = 86400000;

    const lastRunDaysAgo = lastRun
      ? Math.floor((now - new Date(lastRun.started_at).getTime()) / dayMs)
      : null;

    const lastLiftDaysAgo = lastLift
      ? Math.floor((now - new Date(lastLift.started_at).getTime()) / dayMs)
      : null;

    const weeklyRunDistanceM = (weekRuns ?? []).reduce(
      (sum, r) => sum + (Number(r.distance_meters) || 0),
      0
    );

    const fatigueScore = snapshot?.fatigueScore ?? 0;
    let recommendation: "go" | "easy" | "rest" = "go";
    if (fatigueScore > 70) recommendation = "rest";
    else if (fatigueScore > 50) recommendation = "easy";

    let fatigueLabel = "Fresh";
    let fatigueGuidance = "You're good to go!";
    if (fatigueScore > 70) {
      fatigueLabel = "High Fatigue";
      fatigueGuidance = "Consider a rest day or very easy recovery run.";
    } else if (fatigueScore > 50) {
      fatigueLabel = "Moderate Fatigue";
      fatigueGuidance = "Keep it easy — a Zone 2 run would be ideal.";
    } else if (fatigueScore > 30) {
      fatigueLabel = "Normal";
      fatigueGuidance = "Train as planned.";
    }

    return NextResponse.json({
      readiness: {
        fatigueScore,
        fatigueLabel,
        fatigueGuidance,
        lastRunDaysAgo,
        lastLiftDaysAgo,
        weeklyRunDistanceM,
        weeklyRunCount: weekRuns?.length ?? 0,
        recommendation,
      },
    });
  } catch (error) {
    console.error("Run readiness GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
