import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

export interface HistoryStatsResponse {
  total_sessions: number;
  total_volume_kg: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  longest_streak: number;
  top_muscle_groups: Array<{ muscle_group: string; set_count: number }>;
  monthly_breakdown: Array<{ month_key: string; sessions: number; volume_kg: number }>;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data, error } = await supabase.rpc("get_history_stats", {
      p_user_id: user.id,
    });

    if (error) {
      logger.error("History stats RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch history stats" },
        { status: 500 }
      );
    }

    return NextResponse.json(data as HistoryStatsResponse);
  } catch (error) {
    logger.error("History stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
