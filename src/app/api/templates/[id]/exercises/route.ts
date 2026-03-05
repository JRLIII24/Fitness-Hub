/**
 * Template Exercises API
 * GET /api/templates/[id]/exercises
 *
 * Fetches a template's exercises with full exercise details.
 * Used by the coach to populate a workout from a template.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Fetch template and verify ownership
    const { data: template, error: tErr } = await supabase
      .from("workout_templates")
      .select("id, name, user_id")
      .eq("id", id)
      .single();

    if (tErr || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Fetch exercises joined with exercise details
    const { data: templateExercises, error: exErr } = await supabase
      .from("template_exercises")
      .select("*, exercises(*)")
      .eq("template_id", id)
      .order("sort_order");

    if (exErr) {
      return NextResponse.json({ error: "Failed to fetch exercises" }, { status: 500 });
    }

    return NextResponse.json({
      template_name: template.name,
      exercises: templateExercises ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch template exercises" },
      { status: 500 },
    );
  }
}
