/**
 * GET /api/exercises/[id]/videos
 * Returns instructional videos for an exercise (excludes storage_path for security).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: exerciseId } = await params;
    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data, error } = await (supabase as any)
      .from("exercise_instructional_videos")
      .select("id, title, description, duration_seconds, difficulty, sort_order")
      .eq("exercise_id", exerciseId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    logger.error("GET /api/exercises/[id]/videos error:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
