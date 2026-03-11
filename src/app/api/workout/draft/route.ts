/**
 * Workout Draft API
 * GET    /api/workout/draft  — fetch the user's in-progress session draft (for restore banner)
 * PATCH  /api/workout/draft  — upsert draft_data after set completion (fire-and-forget)
 * DELETE /api/workout/draft  — discard the draft (user clicked "Don't restore")
 *
 * draft_data shape:
 * {
 *   workoutName: string,
 *   startedAt: string,
 *   templateId?: string | null,
 *   exercises: WorkoutExercise[]   // full snapshot from workout store
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

const DRAFT_MAX_AGE_HOURS = 4;

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data, error } = await supabase
      .from("active_workout_sessions")
      .select("session_name, started_at, draft_data")
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ draft: null });
    }

    // Ignore stale drafts older than DRAFT_MAX_AGE_HOURS
    const ageMs = Date.now() - new Date(data.started_at).getTime();
    if (ageMs > DRAFT_MAX_AGE_HOURS * 60 * 60 * 1000) {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({
      draft: {
        sessionName: data.session_name,
        startedAt: data.started_at,
        data: data.draft_data ?? null,
      },
    });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const { draft_data } = body as { draft_data: unknown };

    const { error } = await supabase
      .from("active_workout_sessions")
      .update({ draft_data: draft_data as never, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    await supabase
      .from("active_workout_sessions")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
