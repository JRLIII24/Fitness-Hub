/**
 * Template Creation API
 * POST /api/templates/create
 *
 * Creates a workout template with exercises. Used by the AI coach
 * to build templates from conversational input.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { resolveExercise } from "@/lib/program-service";

interface ExerciseInput {
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: string | number;
  target_weight_kg?: number;
  rest_seconds?: number;
  equipment?: string;
  category?: string;
}

interface CreateTemplateBody {
  name: string;
  description?: string;
  primary_muscle_group?: string;
  estimated_duration_min?: number;
  difficulty_level?: string;
  exercises: ExerciseInput[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = (await request.json()) as CreateTemplateBody;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!body.exercises?.length) {
      return NextResponse.json({ error: "At least one exercise is required" }, { status: 400 });
    }
    if (body.exercises.length > 20) {
      return NextResponse.json({ error: "Maximum 20 exercises per template" }, { status: 400 });
    }

    // Resolve exercise names to IDs using shared service
    const resolvedExercises: Array<{ id: string; index: number }> = [];
    const failedExercises: string[] = [];

    for (let i = 0; i < body.exercises.length; i++) {
      const ex = body.exercises[i];
      const exerciseId = await resolveExercise(supabase, user.id, {
        exercise_name: ex.exercise_name,
        muscle_group: ex.muscle_group,
        equipment: ex.equipment,
        category: ex.category,
      }, i);

      if (exerciseId) {
        resolvedExercises.push({ id: exerciseId, index: i });
      } else {
        failedExercises.push(ex.exercise_name || `Exercise ${i + 1}`);
      }
    }

    if (resolvedExercises.length === 0) {
      return NextResponse.json(
        { error: `Could not resolve any exercises. Failed: ${failedExercises.join(", ")}` },
        { status: 400 },
      );
    }

    // Insert workout template
    const { data: template, error: templateErr } = await supabase
      .from("workout_templates")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description || null,
        primary_muscle_group: body.primary_muscle_group || null,
        estimated_duration_min: body.estimated_duration_min || null,
        difficulty_level: body.difficulty_level || null,
        is_public: false,
      })
      .select("id")
      .single();

    if (templateErr || !template) {
      logger.error("Failed to insert workout_templates:", templateErr);
      return NextResponse.json(
        { error: `Failed to create template: ${templateErr?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }

    // Bulk insert template exercises
    const templateExercises = resolvedExercises.map((re) => ({
      template_id: template.id,
      exercise_id: re.id,
      sort_order: re.index,
      target_sets: body.exercises[re.index].target_sets || 3,
      target_reps: String(body.exercises[re.index].target_reps || "8-12"),
      target_weight_kg: body.exercises[re.index].target_weight_kg || null,
      rest_seconds: body.exercises[re.index].rest_seconds || 90,
    }));

    const { error: exerciseInsertErr } = await supabase
      .from("template_exercises")
      .insert(templateExercises);

    if (exerciseInsertErr) {
      logger.error("Failed to insert template_exercises:", exerciseInsertErr);
    }

    return NextResponse.json({
      template_id: template.id,
      template_name: body.name.trim(),
      exercise_count: resolvedExercises.length,
    });
  } catch (error) {
    logger.error("Template creation error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
