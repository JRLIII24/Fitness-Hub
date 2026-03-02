import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { getPodChallengeLeaderboard, deletePodChallenge } from "@/lib/challenges";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import { logger } from "@/lib/logger";

/** GET /api/pods/[podId]/challenges/[challengeId] — fetch a single challenge + its leaderboard */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ podId: string; challengeId: string }> }
) {
  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ error: "Pod challenges are disabled" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { challengeId } = await params;

    const leaderboard = await getPodChallengeLeaderboard(challengeId);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    logger.error("Pod challenge GET error:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Access denied")) {
      return NextResponse.json({ error: "Not a member of this pod" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/pods/[podId]/challenges/[challengeId] — delete a challenge (creator only via RLS) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ podId: string; challengeId: string }> }
) {
  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ error: "Pod challenges are disabled" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { challengeId } = await params;

    await deletePodChallenge(challengeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Pod challenge DELETE error:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete challenge" }, { status: 500 });
  }
}
