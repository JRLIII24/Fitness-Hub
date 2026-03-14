/**
 * POST /api/programs/:id/import
 *
 * Deep-clones a public training program into the calling user's account.
 * The imported program is created with status "not_started" (mapped to "draft")
 * and has its own copy of program_data (template_ids are stripped since they
 * belong to the original creator).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface ProgramDay {
  day_number: number;
  name: string;
  exercises: Array<{
    exercise_name: string;
    muscle_group: string;
    sets: number;
    reps: string;
    rpe_target?: number;
    rest_seconds: number;
  }>;
  template_id?: string;
}

interface ProgramWeek {
  week_number: number;
  focus: string;
  days: ProgramDay[];
}

interface ProgramData {
  name: string;
  description: string;
  weeks: ProgramWeek[];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Rate limit: 10 imports per minute
    const rlAllowed = await rateLimit(`program-import:${user.id}`, 10, 60_000);
    if (!rlAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // Fetch the source program (must be public)
    const { data: source, error: fetchErr } = await supabase
      .from("training_programs")
      .select("id, name, description, goal, weeks, days_per_week, program_data")
      .eq("id", id)
      .eq("is_public", true)
      .single();

    if (fetchErr || !source) {
      return NextResponse.json({ error: "Program not found or not public" }, { status: 404 });
    }

    // Deep-clone program_data, stripping template_ids (those belong to the original creator)
    const originalData = source.program_data as unknown as ProgramData;
    const clonedData: ProgramData = {
      name: originalData.name,
      description: originalData.description,
      weeks: (originalData.weeks ?? []).map((week) => ({
        week_number: week.week_number,
        focus: week.focus,
        days: (week.days ?? []).map((day) => ({
          day_number: day.day_number,
          name: day.name,
          exercises: day.exercises.map((ex) => ({
            exercise_name: ex.exercise_name,
            muscle_group: ex.muscle_group,
            sets: ex.sets,
            reps: ex.reps,
            rpe_target: ex.rpe_target,
            rest_seconds: ex.rest_seconds,
          })),
          // template_id intentionally omitted — user will create their own when they start
        })),
      })),
    };

    // Insert the cloned program
    const { data: imported, error: insertErr } = await supabase
      .from("training_programs")
      .insert({
        user_id: user.id,
        name: source.name,
        description: source.description
          ? `${source.description}\n\n[Imported from marketplace]`
          : "Imported from marketplace",
        goal: source.goal,
        weeks: source.weeks,
        days_per_week: source.days_per_week,
        status: "draft",
        current_week: 1,
        current_day: 1,
        program_data: clonedData as any,
      } as any)
      .select("id")
      .single();

    if (insertErr || !imported) {
      logger.error("[/api/programs/import] insert error:", insertErr);
      return NextResponse.json({ error: "Failed to import program" }, { status: 500 });
    }

    return NextResponse.json({
      programId: imported.id,
      imported: true,
    });
  } catch (err) {
    logger.error("[/api/programs/import] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
