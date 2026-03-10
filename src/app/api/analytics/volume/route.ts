/**
 * Analytics Volume API
 * GET /api/analytics/volume — weekly volume aggregates + per-muscle-group breakdown
 *
 * Query params:
 *   weeks (default 12) — number of weeks to look back
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

interface WeeklyVolume {
  week_start: string;
  total_volume_kg: number;
}

interface MuscleGroupVolume {
  muscle_group: string;
  total_volume_kg: number;
  set_count: number;
}

export interface AnalyticsVolumeResponse {
  weekly_volume: WeeklyVolume[];
  muscle_breakdown: MuscleGroupVolume[];
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const weeksParam = req.nextUrl.searchParams.get("weeks");
    const weeks = Math.min(Math.max(Number(weeksParam) || 12, 1), 52);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    // Weekly volume: aggregate workout_sets by week via workout_sessions
    const { data: weeklyRaw, error: weeklyErr } = await supabase
      .from("workout_sets")
      .select(`
        weight_kg,
        reps,
        workout_exercises!inner (
          workout_sessions!inner (
            user_id,
            started_at
          )
        )
      `)
      .eq("workout_exercises.workout_sessions.user_id", user.id)
      .gte("workout_exercises.workout_sessions.started_at", cutoff)
      .not("weight_kg", "is", null)
      .not("reps", "is", null);

    if (weeklyErr) {
      logger.error("Analytics weekly volume query error:", weeklyErr);
      return NextResponse.json(
        { error: "Failed to fetch weekly volume" },
        { status: 500 }
      );
    }

    // Aggregate by week
    const weekMap = new Map<string, number>();
    for (const row of weeklyRaw || []) {
      const session = (row as Record<string, unknown>).workout_exercises as Record<string, unknown>;
      const ws = session.workout_sessions as Record<string, unknown>;
      const startedAt = ws.started_at as string;
      const date = new Date(startedAt);
      // Get Monday of the week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      const weekKey = monday.toISOString().split("T")[0];

      const volume = (row.weight_kg ?? 0) * (row.reps ?? 0);
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + volume);
    }

    const weekly_volume: WeeklyVolume[] = Array.from(weekMap.entries())
      .map(([week_start, total_volume_kg]) => ({
        week_start,
        total_volume_kg: Math.round(total_volume_kg),
      }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start));

    // Muscle group breakdown (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDayCutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: muscleRaw, error: muscleErr } = await supabase
      .from("workout_sets")
      .select(`
        weight_kg,
        reps,
        workout_exercises!inner (
          exercises!inner (
            muscle_group
          ),
          workout_sessions!inner (
            user_id,
            started_at
          )
        )
      `)
      .eq("workout_exercises.workout_sessions.user_id", user.id)
      .gte("workout_exercises.workout_sessions.started_at", thirtyDayCutoff)
      .not("weight_kg", "is", null)
      .not("reps", "is", null);

    if (muscleErr) {
      logger.error("Analytics muscle breakdown query error:", muscleErr);
      return NextResponse.json(
        { error: "Failed to fetch muscle breakdown" },
        { status: 500 }
      );
    }

    const muscleMap = new Map<string, { volume: number; sets: number }>();
    for (const row of muscleRaw || []) {
      const we = (row as Record<string, unknown>).workout_exercises as Record<string, unknown>;
      const exercise = we.exercises as Record<string, unknown>;
      const muscleGroup = (exercise.muscle_group as string) || "other";
      const volume = (row.weight_kg ?? 0) * (row.reps ?? 0);

      const existing = muscleMap.get(muscleGroup) ?? { volume: 0, sets: 0 };
      existing.volume += volume;
      existing.sets += 1;
      muscleMap.set(muscleGroup, existing);
    }

    const muscle_breakdown: MuscleGroupVolume[] = Array.from(muscleMap.entries())
      .map(([muscle_group, data]) => ({
        muscle_group,
        total_volume_kg: Math.round(data.volume),
        set_count: data.sets,
      }))
      .sort((a, b) => b.total_volume_kg - a.total_volume_kg);

    const response: AnalyticsVolumeResponse = {
      weekly_volume,
      muscle_breakdown,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Analytics volume error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
