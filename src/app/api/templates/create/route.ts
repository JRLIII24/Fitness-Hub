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

const VALID_EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "band"] as const;
const VALID_CATEGORY = ["compound", "isolation", "cardio", "stretch"] as const;

function toValidEquipment(val?: string): (typeof VALID_EQUIPMENT)[number] {
  if (val && (VALID_EQUIPMENT as readonly string[]).includes(val)) return val as (typeof VALID_EQUIPMENT)[number];
  return "barbell";
}

function toValidCategory(val?: string): (typeof VALID_CATEGORY)[number] {
  if (val && (VALID_CATEGORY as readonly string[]).includes(val)) return val as (typeof VALID_CATEGORY)[number];
  return "compound";
}

interface ExerciseInput {
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: string;
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

    // Resolve exercise names to IDs
    const resolvedExercises: Array<{ id: string; index: number }> = [];

    for (let i = 0; i < body.exercises.length; i++) {
      const ex = body.exercises[i];

      // Search by name (case-insensitive exact match)
      const { data: found } = await supabase
        .from("exercises")
        .select("id")
        .ilike("name", ex.exercise_name)
        .limit(1);

      if (found && found.length > 0) {
        resolvedExercises.push({ id: found[0].id, index: i });
        continue;
      }

      // Try fuzzy match
      const { data: fuzzy } = await supabase
        .from("exercises")
        .select("id")
        .ilike("name", `%${ex.exercise_name}%`)
        .limit(1);

      if (fuzzy && fuzzy.length > 0) {
        resolvedExercises.push({ id: fuzzy[0].id, index: i });
        continue;
      }

      // Not found — create as custom exercise
      const slug = `${ex.exercise_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}-${Date.now()}-${i}`;
      const { data: created, error: createErr } = await supabase
        .from("exercises")
        .insert({
          name: ex.exercise_name.trim(),
          slug,
          muscle_group: ex.muscle_group || "chest",
          equipment: toValidEquipment(ex.equipment),
          category: toValidCategory(ex.category),
          is_custom: true,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (created && !createErr) {
        resolvedExercises.push({ id: created.id, index: i });
      }
    }

    if (resolvedExercises.length === 0) {
      return NextResponse.json(
        { error: "Could not resolve any exercises" },
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
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 },
      );
    }

    // Bulk insert template exercises
    const templateExercises = resolvedExercises.map((re) => ({
      template_id: template.id,
      exercise_id: re.id,
      sort_order: re.index,
      target_sets: body.exercises[re.index].target_sets || 3,
      target_reps: body.exercises[re.index].target_reps || "8-12",
      target_weight_kg: body.exercises[re.index].target_weight_kg || null,
      rest_seconds: body.exercises[re.index].rest_seconds || 90,
    }));

    await supabase.from("template_exercises").insert(templateExercises);

    return NextResponse.json({
      template_id: template.id,
      template_name: body.name.trim(),
      exercise_count: resolvedExercises.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
