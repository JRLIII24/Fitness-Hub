import { z } from "zod";

// ── Voice Intent ──

export const VoiceIntentTypeSchema = z.enum([
  "log_set",
  "start_timer",
  "stop_timer",
  "swap_exercise",
  "ask_coach",
  "unknown",
]);

export const ParsedSetDataSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  unit: z.enum(["kg", "lbs"]).nullable(),
  set_type: z.enum(["warmup", "working", "dropset", "failure"]).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  rir: z.number().min(0).max(10).nullable(),
  notes: z.string().max(200).nullable(),
});

export const VoiceIntentSchema = z.object({
  type: VoiceIntentTypeSchema,
  confidence: z.number().min(0).max(1),
  parsed_data: z
    .object({
      sets: z.array(ParsedSetDataSchema).optional(),
      timer_seconds: z.number().optional(),
      exercise_name: z.string().optional(),
      coach_query: z.string().optional(),
    })
    .nullable(),
});

export type VoiceIntentType = z.infer<typeof VoiceIntentTypeSchema>;
export type ParsedSetData = z.infer<typeof ParsedSetDataSchema>;
export type VoiceIntent = z.infer<typeof VoiceIntentSchema>;

// ── Coach Chat ──

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  action?: CoachAction;
  data?: Record<string, unknown>;
  /** Result of executing a mutation action */
  actionResult?: { success: boolean; message: string };
}

export type CoachAction =
  // Display-only actions
  | "show_exercise_history"
  | "generate_workout"
  | "show_substitution"
  | "show_readiness"
  | "show_recovery"
  | "show_prescription"
  // Mutation actions (modify active workout)
  | "add_exercise"
  | "swap_exercise"
  | "add_sets"
  | "update_set"
  | "remove_exercise"
  | "create_and_add_exercise"
  | "start_timer"
  // Template actions
  | "create_template"
  | "start_workout_from_template"
  // Navigation
  | "navigate_to"
  | "none";

/** All actions that require execution through the action executor */
export const MUTATION_ACTIONS: CoachAction[] = [
  "add_exercise",
  "swap_exercise",
  "add_sets",
  "update_set",
  "remove_exercise",
  "create_and_add_exercise",
  "start_timer",
  "create_template",
  "start_workout_from_template",
  "navigate_to",
];

export function isMutationAction(action: CoachAction): boolean {
  return MUTATION_ACTIONS.includes(action);
}

// ── Action Data Types ──

export interface AddExerciseActionData {
  exercise_name: string;
  muscle_group: string;
  sets?: Array<{ weight_kg: number; reps: number; set_type?: string }>;
}

export interface SwapExerciseActionData {
  current_exercise_name: string;
  new_exercise_name: string;
  new_muscle_group: string;
  reason: string;
}

export interface AddSetsActionData {
  exercise_name: string;
  sets: Array<{ weight_kg: number; reps: number; rpe?: number; rir?: number; set_type?: string }>;
}

export interface UpdateSetActionData {
  exercise_name: string;
  set_number: number;
  updates: { weight_kg?: number; reps?: number; rpe?: number; rir?: number };
}

export interface RemoveExerciseActionData {
  exercise_name: string;
  reason: string;
}

export interface CreateAndAddExerciseActionData {
  exercise_name: string;
  muscle_group: string;
  equipment: string;
  category: string;
  sets?: Array<{ weight_kg: number; reps: number; set_type?: string }>;
}

export interface StartTimerActionData {
  seconds: number;
}

export type NavigateToScreen =
  | "dashboard"
  | "workout"
  | "nutrition"
  | "history"
  | "body"
  | "marketplace"
  | "pods"
  | "exercises"
  | "settings";

export interface NavigateToActionData {
  screen: NavigateToScreen;
}

// ── Template Action Data Types ──

export interface CreateTemplateExerciseData {
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: string;
  target_weight_kg?: number;
  rest_seconds?: number;
  equipment?: string;
  category?: string;
}

export interface CreateTemplateActionData {
  template_name: string;
  description?: string;
  primary_muscle_group: string;
  estimated_duration_min?: number;
  difficulty_level?: string;
  exercises: CreateTemplateExerciseData[];
}

export interface StartWorkoutFromTemplateActionData {
  template_id: string;
  template_name: string;
}

// ── Coach Context ──

export interface CoachContext {
  active_workout: {
    name: string;
    exercises: Array<{
      name: string;
      muscle_group: string;
      sets_completed: number;
      sets_total: number;
      sets: Array<{
        set_number: number;
        weight_kg: number | null;
        reps: number | null;
        set_type: string;
        completed: boolean;
        rpe?: number | null;
        rir?: number | null;
      }>;
    }>;
    duration_minutes: number;
  } | null;
  readiness_score: number | null;
  readiness_level: string | null;
  recent_sessions_7d: number;
  current_streak: number;
  fitness_goal: string | null;
  experience_level: string | null;
  /** Today's macro targets and consumption */
  daily_macros: {
    target_calories: number;
    consumed_calories: number;
    target_protein: number;
    consumed_protein: number;
    target_carbs: number;
    consumed_carbs: number;
    target_fat: number;
    consumed_fat: number;
  } | null;
  /** Last 3 personal records as readable strings e.g. "Bench Press: 225 lbs × 5" */
  recent_prs: string[] | null;
}

export interface CoachRequest {
  message: string;
  conversation_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  context: CoachContext;
}

const ALL_COACH_ACTIONS = [
  "show_exercise_history",
  "generate_workout",
  "show_substitution",
  "show_readiness",
  "show_recovery",
  "show_prescription",
  "add_exercise",
  "swap_exercise",
  "add_sets",
  "update_set",
  "remove_exercise",
  "create_and_add_exercise",
  "start_timer",
  "create_template",
  "start_workout_from_template",
  "navigate_to",
  "none",
] as const;

export const CoachResponseSchema = z.object({
  reply: z.string().max(2000),
  action: z
    .enum(ALL_COACH_ACTIONS)
    .optional().default("none"),
  // AI sometimes returns the string "null" instead of actual null — coerce it
  data: z.preprocess(
    (v) => (v === "null" || v === "" ? null : v),
    z.record(z.string(), z.unknown()).nullable().optional(),
  ),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

// ── Autoregulation Prescription ──

export const AutoregulationPrescriptionSchema = z.object({
  exercise_name: z.string().max(200),
  target_weight_kg: z.number().min(0).max(1000),
  target_reps: z.number().min(1).max(100),
  target_sets: z.number().min(1).max(20),
  rationale: z.string().max(500),
  readiness_factor: z.enum(["push", "maintain", "deload"]),
  progressive_overload_pct: z.number().min(-50).max(50),
});

export type AutoregulationPrescription = z.infer<
  typeof AutoregulationPrescriptionSchema
>;
