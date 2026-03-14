import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Monday-based week boundaries (UTC)
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();
    const prevWeekStartISO = prevWeekStart.toISOString();
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // ── Current week sessions ─────────────────────────────────────
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, total_volume_kg, duration_seconds, completed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", weekStartISO)
      .lt("completed_at", weekEndISO);

    const currentSessions = sessions ?? [];
    const totalSessions = currentSessions.length;
    const totalVolumeKg = currentSessions.reduce(
      (sum, s) => sum + (s.total_volume_kg ?? 0),
      0
    );
    const totalDurationSeconds = currentSessions.reduce(
      (sum, s) => sum + (s.duration_seconds ?? 0),
      0
    );

    // ── Previous week sessions (for WoW comparison) ───────────────
    const { data: prevSessions } = await supabase
      .from("workout_sessions")
      .select("total_volume_kg")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", prevWeekStartISO)
      .lt("completed_at", weekStartISO);

    const prevWeekSessions = prevSessions?.length ?? 0;
    const prevWeekVolume = (prevSessions ?? []).reduce(
      (sum, s) => sum + (s.total_volume_kg ?? 0),
      0
    );

    // ── Muscle groups + PRs from workout_sets ─────────────────────
    const sessionIds = currentSessions.map((s) => s.id);

    let muscleGroups: { muscle_group: string; sets: number }[] = [];
    let prs: { exercise: string; weight_kg: number; reps: number }[] = [];

    if (sessionIds.length > 0) {
      const { data: sets } = await supabase
        .from("workout_sets")
        .select(
          "weight_kg, reps, exercise_id, exercises!inner(name, muscle_group)"
        )
        .in("session_id", sessionIds)
        .not("completed_at", "is", null);

      if (sets && sets.length > 0) {
        // Muscle group aggregation
        const mgMap = new Map<string, number>();
        for (const s of sets) {
          const ex = s.exercises as unknown as {
            name: string;
            muscle_group: string;
          };
          const mg = ex.muscle_group;
          mgMap.set(mg, (mgMap.get(mg) ?? 0) + 1);
        }
        muscleGroups = Array.from(mgMap.entries())
          .map(([muscle_group, sets]) => ({ muscle_group, sets }))
          .sort((a, b) => b.sets - a.sets);

        // PRs: best weight*reps per exercise this week
        const prMap = new Map<
          string,
          { exercise: string; weight_kg: number; reps: number; score: number }
        >();
        for (const s of sets) {
          const ex = s.exercises as unknown as {
            name: string;
            muscle_group: string;
          };
          if (s.weight_kg == null || s.reps == null) continue;
          const score = s.weight_kg * s.reps;
          const existing = prMap.get(ex.name);
          if (!existing || score > existing.score) {
            prMap.set(ex.name, {
              exercise: ex.name,
              weight_kg: s.weight_kg,
              reps: s.reps,
              score,
            });
          }
        }
        prs = Array.from(prMap.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(({ exercise, weight_kg, reps }) => ({
            exercise,
            weight_kg,
            reps,
          }));
      }
    }

    // ── Nutrition compliance (last 7 days) ────────────────────────
    let nutrition: {
      days_tracked: number;
      avg_calorie_pct: number;
      avg_protein_pct: number;
    } | null = null;

    const { data: nutritionGoal } = await supabase
      .from("nutrition_goals")
      .select("calories_target, protein_g_target")
      .eq("user_id", user.id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (nutritionGoal?.calories_target) {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);

      const { data: logs } = await supabase
        .from("food_log")
        .select("logged_at, calories_consumed, protein_g")
        .eq("user_id", user.id)
        .gte("logged_at", sevenDaysAgo.toISOString());

      if (logs && logs.length > 0) {
        // Group by day
        const dayMap = new Map<
          string,
          { calories: number; protein: number }
        >();
        for (const l of logs) {
          const dayKey = l.logged_at.slice(0, 10);
          const entry = dayMap.get(dayKey) ?? { calories: 0, protein: 0 };
          entry.calories += l.calories_consumed ?? 0;
          entry.protein += l.protein_g ?? 0;
          dayMap.set(dayKey, entry);
        }

        const days = Array.from(dayMap.values());
        const daysTracked = days.length;
        const avgCalPct =
          days.reduce(
            (sum, d) => sum + (d.calories / nutritionGoal.calories_target!) * 100,
            0
          ) / daysTracked;
        const avgProtPct =
          nutritionGoal.protein_g_target && nutritionGoal.protein_g_target > 0
            ? days.reduce(
                (sum, d) =>
                  sum +
                  (d.protein / nutritionGoal.protein_g_target!) * 100,
                0
              ) / daysTracked
            : 0;

        nutrition = {
          days_tracked: daysTracked,
          avg_calorie_pct: Math.round(avgCalPct),
          avg_protein_pct: Math.round(avgProtPct),
        };
      }
    }

    return NextResponse.json({
      training: {
        total_sessions: totalSessions,
        total_volume_kg: totalVolumeKg,
        total_duration_seconds: totalDurationSeconds,
        muscle_groups: muscleGroups,
        prs,
        prev_week_volume: prevWeekVolume,
        prev_week_sessions: prevWeekSessions,
      },
      nutrition,
      week_start: weekStartStr,
      week_end: weekEndStr,
    });
  } catch (error) {
    logger.error("Weekly review GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
