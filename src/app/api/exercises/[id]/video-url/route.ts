/**
 * GET /api/exercises/[id]/video-url?videoId=UUID
 * Returns a 5-minute signed URL for a specific instructional video.
 * storage_path is never exposed to the client -- only signed URLs are returned.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

const SIGNED_URL_TTL = 300; // 5 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: exerciseId } = await params;
    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Fetch row -- verifies the video belongs to this exercise (prevents path fishing)
    const { data: row, error: rowErr } = await (supabase as any)
      .from("exercise_instructional_videos")
      .select("storage_path")
      .eq("id", videoId)
      .eq("exercise_id", exerciseId)
      .single();

    if (rowErr || !row) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const { data: urlData, error: urlErr } = await supabase.storage
      .from("exercise-videos")
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL);

    if (urlErr || !urlData?.signedUrl) {
      logger.error("Signed URL generation failed:", urlErr);
      return NextResponse.json({ error: "Could not generate video URL" }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString();
    return NextResponse.json({ signedUrl: urlData.signedUrl, expiresAt });
  } catch (error) {
    logger.error("GET /api/exercises/[id]/video-url error:", error);
    return NextResponse.json({ error: "Failed to get video URL" }, { status: 500 });
  }
}
