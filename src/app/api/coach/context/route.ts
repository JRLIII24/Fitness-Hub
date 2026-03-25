/**
 * Coach Context API
 * GET /api/coach/context
 *
 * Returns the rich profile context the AI coach needs:
 *   - fitness_goal, experience_level, current_streak, level
 *   - recent_prs: top-5 PRs as human-readable strings
 *   - recent_session_notes: last 3 AI-generated Coach's Notes (episodic memory)
 *   - acwr, acwr_status, fatigue_label: training load metrics
 *
 * Called once on mount by CoachFabWrapper to enrich CoachContext.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { kgToLbs } from "@/lib/units";
import { computeAndCacheFatigueSnapshot } from "@/lib/fatigue/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // ── Profile fields ────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("fitness_goal, experience_level, current_streak, level, unit_preference")
      .eq("id", user.id)
      .single();

    const isImperial = (profile?.unit_preference ?? "metric") === "imperial";

    // ── Top-5 PRs (best raw weight per exercise, working sets only) ───────────
    const { data: rawPRs } = await supabase
      .from("workout_sets")
      .select(`
        weight_kg,
        reps,
        exercises!inner(id, name, muscle_group),
        workout_sessions!inner(user_id, status)
      `)
      .eq("workout_sessions.user_id", user.id)
      .eq("workout_sessions.status", "completed")
      .eq("set_type", "working")
      .not("weight_kg", "is", null)
      .gt("weight_kg", 0)
      .order("weight_kg", { ascending: false });

    type RawRow = {
      weight_kg: number | null;
      reps: number | null;
      exercises: { id: string; name: string } | { id: string; name: string }[] | null;
      workout_sessions: { user_id: string; status: string } | { user_id: string; status: string }[] | null;
    };

    const rows = (rawPRs ?? []) as RawRow[];

    // Aggregate best weight per exercise
    const prMap = new Map<string, { name: string; weight_kg: number; reps: number | null }>();

    for (const row of rows) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (!ex || !row.weight_kg) continue;
      const existing = prMap.get(ex.id);
      if (!existing || row.weight_kg > existing.weight_kg) {
        prMap.set(ex.id, { name: ex.name, weight_kg: row.weight_kg, reps: row.reps });
      }
    }

    // Sort by weight desc, take top 5, format as readable strings
    const recent_prs = [...prMap.values()]
      .sort((a, b) => b.weight_kg - a.weight_kg)
      .slice(0, 5)
      .map(({ name, weight_kg, reps }) => {
        const display = isImperial
          ? `${Math.round(kgToLbs(weight_kg))} lbs`
          : `${Math.round(weight_kg * 10) / 10} kg`;
        return reps ? `${name}: ${display} × ${reps}` : `${name}: ${display}`;
      });

    // ── Last 3 session summaries (episodic memory) ──────────────────────────
    const { data: summaries } = await supabase
      .from("session_summaries")
      .select("summary, key_observations, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    // ── Sessions in the last 7 days ───────────────────────────────────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: recentSessionCount } = await supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", sevenDaysAgo.toISOString());

    // ── ACWR from fatigue engine (non-critical) ───────────────────────────────
    let acwr: number | null = null;
    let acwr_status: string | null = null;
    let fatigue_label: string | null = null;

    try {
      const snapshot = await computeAndCacheFatigueSnapshot(user.id);
      const { avgLoad7d, avgLoad28d } = snapshot.metadata;
      if (avgLoad7d != null && avgLoad28d != null && avgLoad28d > 0) {
        acwr = Math.round((avgLoad7d / avgLoad28d) * 100) / 100;
        if (acwr > 1.5) acwr_status = "danger";
        else if (acwr > 1.3) acwr_status = "high";
        else if (acwr > 1.1) acwr_status = "elevated";
        else if (acwr >= 0.8) acwr_status = "optimal";
        else acwr_status = "underloaded";
      }
      fatigue_label = snapshot.recommendation.label;
    } catch (e) {
      logger.error("ACWR computation failed (non-critical):", e);
    }

    // ── User's custom exercises ──────────────────────────────────────────────
    const { data: customExercises } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .eq("is_custom", true)
      .eq("created_by", user.id)
      .order("name", { ascending: true })
      .limit(50);

    return NextResponse.json({
      fitness_goal: profile?.fitness_goal ?? null,
      experience_level: profile?.experience_level ?? null,
      current_streak: profile?.current_streak ?? 0,
      level: profile?.level ?? 1,
      recent_prs: recent_prs.length > 0 ? recent_prs : null,
      recent_session_notes: summaries && summaries.length > 0 ? summaries : null,
      recent_sessions_7d: recentSessionCount ?? 0,
      acwr,
      acwr_status,
      fatigue_label,
      custom_exercises: customExercises && customExercises.length > 0
        ? customExercises.map((e) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, equipment: e.equipment }))
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch coach context" }, { status: 500 });
  }
}
