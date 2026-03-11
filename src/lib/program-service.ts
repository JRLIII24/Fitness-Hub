/**
 * Program Service — shared template creation logic for AI-generated programs.
 *
 * Extracts exercise resolution (fuzzy matching + custom creation) from
 * /api/templates/create so both template creation and program-start flows
 * can reuse it without duplication.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const VALID_EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "band"] as const;
const VALID_CATEGORY = ["compound", "isolation", "cardio", "stretch"] as const;
const VALID_MUSCLE_GROUP = ["chest", "back", "legs", "shoulders", "arms", "core", "full_body"] as const;

export function toValidEquipment(val?: string): (typeof VALID_EQUIPMENT)[number] {
  if (val && (VALID_EQUIPMENT as readonly string[]).includes(val.toLowerCase()))
    return val.toLowerCase() as (typeof VALID_EQUIPMENT)[number];
  return "barbell";
}

export function toValidCategory(val?: string): (typeof VALID_CATEGORY)[number] {
  if (val && (VALID_CATEGORY as readonly string[]).includes(val.toLowerCase()))
    return val.toLowerCase() as (typeof VALID_CATEGORY)[number];
  return "compound";
}

export function toValidMuscleGroup(val?: string): (typeof VALID_MUSCLE_GROUP)[number] {
  if (!val) return "chest";
  const lower = val.toLowerCase().replace(/[_\s-]+/g, "_");
  if ((VALID_MUSCLE_GROUP as readonly string[]).includes(lower))
    return lower as (typeof VALID_MUSCLE_GROUP)[number];
  if (lower.includes("chest") || lower.includes("pec")) return "chest";
  if (lower.includes("back") || lower.includes("lat")) return "back";
  if (lower.includes("leg") || lower.includes("quad") || lower.includes("hamstring") || lower.includes("glute") || lower.includes("calf"))
    return "legs";
  if (lower.includes("shoulder") || lower.includes("delt")) return "shoulders";
  if (lower.includes("arm") || lower.includes("bicep") || lower.includes("tricep")) return "arms";
  if (lower.includes("core") || lower.includes("ab")) return "core";
  return "full_body";
}

function extractKeywords(name: string): string[] {
  const stopWords = new Set(["the", "a", "an", "with", "on", "for", "and", "or", "to"]);
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

export interface ExerciseInput {
  exercise_name: string;
  muscle_group: string;
  equipment?: string;
  category?: string;
}

/**
 * Resolve an exercise name to a DB exercise ID using fuzzy matching.
 * Creates a custom exercise as fallback.
 */
export async function resolveExercise(
  supabase: SupabaseClient,
  userId: string,
  ex: ExerciseInput,
  index: number,
): Promise<string | null> {
  const name = ex.exercise_name?.trim();
  if (!name) return null;

  // 1. Exact case-insensitive match
  const { data: found } = await supabase
    .from("exercises")
    .select("id")
    .ilike("name", name)
    .limit(1);
  if (found?.length) return found[0].id;

  // 2. Fuzzy: DB name contains AI name
  const { data: fuzzy1 } = await supabase
    .from("exercises")
    .select("id")
    .ilike("name", `%${name}%`)
    .limit(1);
  if (fuzzy1?.length) return fuzzy1[0].id;

  // 3. Multi-keyword matching
  const keywords = extractKeywords(name);
  if (keywords.length >= 2) {
    const { data: fuzzy2 } = await supabase
      .from("exercises")
      .select("id, name")
      .ilike("name", `%${keywords[0]}%`)
      .ilike("name", `%${keywords[1]}%`)
      .limit(5);

    if (fuzzy2?.length) {
      let bestId = fuzzy2[0].id;
      let bestScore = 0;
      for (const candidate of fuzzy2) {
        const cLower = candidate.name.toLowerCase();
        const score = keywords.filter((k) => cLower.includes(k)).length;
        if (score > bestScore) {
          bestScore = score;
          bestId = candidate.id;
        }
      }
      return bestId;
    }
  }

  // 4. Single keyword fallback
  if (keywords.length >= 1) {
    const distinctWord = keywords[keywords.length - 1];
    if (distinctWord.length >= 3) {
      const { data: fuzzy3 } = await supabase
        .from("exercises")
        .select("id")
        .ilike("name", `%${distinctWord}%`)
        .limit(1);
      if (fuzzy3?.length) return fuzzy3[0].id;
    }
  }

  // 5. Create custom exercise
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}-${Date.now()}-${index}`;
  const { data: created, error: createErr } = await supabase
    .from("exercises")
    .insert({
      name,
      slug,
      muscle_group: toValidMuscleGroup(ex.muscle_group),
      equipment: toValidEquipment(ex.equipment),
      category: toValidCategory(ex.category),
      is_custom: true,
      created_by: userId,
    })
    .select("id")
    .single();

  if (created && !createErr) return created.id;
  logger.error(`Failed to create custom exercise "${name}":`, createErr);
  return null;
}

export interface ProgramDayData {
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
}

/**
 * Create a workout template from a program day's data.
 * Returns the template ID or null on failure.
 */
export async function createTemplateFromProgramDay(
  supabase: SupabaseClient,
  userId: string,
  programName: string,
  weekNumber: number,
  day: ProgramDayData,
  programId?: string,
): Promise<string | null> {
  const resolvedExercises: Array<{ id: string; index: number }> = [];

  for (let i = 0; i < day.exercises.length; i++) {
    const ex = day.exercises[i];
    const exerciseId = await resolveExercise(supabase, userId, {
      exercise_name: ex.exercise_name,
      muscle_group: ex.muscle_group,
    }, i);
    if (exerciseId) {
      resolvedExercises.push({ id: exerciseId, index: i });
    }
  }

  if (resolvedExercises.length === 0) return null;

  const templateName = `${programName} — W${weekNumber}D${day.day_number}: ${day.name}`;

  const { data: template, error: templateErr } = await supabase
    .from("workout_templates")
    .insert({
      user_id: userId,
      name: templateName,
      description: `Week ${weekNumber}, Day ${day.day_number} of ${programName}`,
      primary_muscle_group: day.exercises[0]?.muscle_group || null,
      is_public: false,
      ...(programId ? { program_id: programId } : {}),
    })
    .select("id")
    .single();

  if (templateErr || !template) {
    logger.error("Failed to create program day template:", templateErr);
    return null;
  }

  const templateExercises = resolvedExercises.map((re) => ({
    template_id: template.id,
    exercise_id: re.id,
    sort_order: re.index,
    target_sets: day.exercises[re.index].sets || 3,
    target_reps: String(day.exercises[re.index].reps || "8-12"),
    rest_seconds: day.exercises[re.index].rest_seconds || 90,
  }));

  const { error: exerciseInsertErr } = await supabase
    .from("template_exercises")
    .insert(templateExercises);

  if (exerciseInsertErr) {
    logger.error("Failed to insert program day template exercises:", exerciseInsertErr);
  }

  return template.id;
}
