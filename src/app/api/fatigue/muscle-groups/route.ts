import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import {
  computeRecoveryStatus,
  getDisplayName,
  type MuscleGroupRecovery,
} from "@/lib/fatigue/muscle-group";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data, error } = await supabase.rpc("get_muscle_group_recovery", {
      p_user_id: user.id,
      p_lookback_days: 14,
    });

    if (error) {
      logger.error("Muscle group recovery RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch muscle group recovery" },
        { status: 500 }
      );
    }

    const recoveries: MuscleGroupRecovery[] = (data ?? []).map(
      (row: {
        muscle_group: string;
        last_trained_at: string | null;
        hours_since_trained: number | null;
        total_sets: number;
        total_volume_kg: number;
        avg_rpe: number | null;
      }) => {
        const { status, pct } = computeRecoveryStatus(
          row.hours_since_trained,
          row.total_sets,
          row.avg_rpe
        );
        return {
          muscleGroup: row.muscle_group,
          displayName: getDisplayName(row.muscle_group),
          lastTrainedAt: row.last_trained_at,
          hoursSinceTrained: row.hours_since_trained,
          totalSets: row.total_sets,
          totalVolumeKg: row.total_volume_kg,
          recoveryStatus: status,
          recoveryPct: pct,
        };
      }
    );

    // Sort: fatigued first, then recovering, then recovered
    const statusOrder = { fatigued: 0, recovering: 1, recovered: 2, untrained: 3 };
    recoveries.sort(
      (a, b) => statusOrder[a.recoveryStatus] - statusOrder[b.recoveryStatus]
    );

    return NextResponse.json({ recoveries });
  } catch (error) {
    logger.error("Muscle group recovery error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
