import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { getPodChallenges, getPodChallengeLeaderboard } from "@/lib/challenges";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import { logger } from "@/lib/logger";

/**
 * GET /api/pods/[podId]/leaderboards
 *
 * Returns leaderboards for all currently active challenges in this pod.
 * Used by usePodLeaderboard hook + PodLeaderboard component for real-time display.
 *
 * Response: { leaderboards: ChallengeLeaderboard[] }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ podId: string }> }
) {
  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ leaderboards: [] });
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { podId } = await params;

    // Verify caller is an active pod member before querying sensitive RPC
    const { data: membership } = await supabase
      .from("pod_members")
      .select("user_id")
      .eq("pod_id", podId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this pod" }, { status: 403 });
    }

    // Get only active (in-window) challenges
    const activeChallenges = await getPodChallenges(podId, { activeOnly: true });

    if (activeChallenges.length === 0) {
      return NextResponse.json({ leaderboards: [] });
    }

    // Fetch each leaderboard in parallel — soft-fail per challenge so one
    // failing RPC call doesn't blank the whole section
    const results = await Promise.all(
      activeChallenges.map((c) =>
        getPodChallengeLeaderboard(c.id).catch((err) => {
          logger.error(`Leaderboard RPC failed for challenge ${c.id}:`, err);
          return null;
        })
      )
    );

    const leaderboards = results.filter(Boolean);

    return NextResponse.json(
      { leaderboards },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } }
    );
  } catch (error) {
    logger.error("Pod leaderboards GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
