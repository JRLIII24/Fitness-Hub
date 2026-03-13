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

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
export const ParsedSetDataSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  unit: z.enum(["kg", "lbs"]).nullable(),
  set_type: z.enum(["warmup", "working", "dropset", "failure"]).nullable(),
  rpe: z.number().nullable(),
  rir: z.number().nullable(),
  notes: z.string().nullable(),
});

export const VoiceIntentSchema = z.object({
  type: VoiceIntentTypeSchema,
  confidence: z.number(),
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
  /** True while the message content is being streamed in */
  isStreaming?: boolean;
  /** Destructive action awaiting user confirmation */
  pendingAction?: PendingAction;
  /** Set after user dismisses a pending action */
  dismissed?: boolean;
}

export type CoachAction =
  // Display-only actions
  | "show_exercise_history"
  | "generate_workout"
  | "present_workout_options"
  | "show_substitution"
  | "show_readiness"
  | "show_recovery"
  | "show_prescription"
  | "show_meal_suggestion"
  | "show_macro_breakdown"
  // Mutation actions (modify active workout)
  | "add_exercise"
  | "swap_exercise"
  | "add_sets"
  | "update_set"
  | "remove_exercise"
  | "create_and_add_exercise"
  | "start_timer"
  // Nutrition mutation
  | "log_quick_meal"
  // Template actions
  | "create_template"
  | "start_workout_from_template"
  // Program actions
  | "create_program"
  // Memory
  | "save_memory"
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
  "log_quick_meal",
  "create_template",
  "start_workout_from_template",
  "create_program",
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
  | "settings"
  | "form_check"
  | "programs"
  | "reports";

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
  exercises: CreateTemplateExerciseData[];
  /** When true, immediately start a workout from this template after saving it. */
  start_immediately?: boolean;
}

export interface StartWorkoutFromTemplateActionData {
  template_id: string;
  template_name: string;
}

// ── Nutrition Action Data Types ──

export interface MealSuggestionActionData {
  meal_name: string;
  description?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface LogQuickMealActionData {
  description: string;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
}

// ── Program Action Data Types ──

export interface CreateProgramActionData {
  goal: string;
  weeks: number;
  days_per_week: number;
  focus_areas?: string[];
}

// ── Memory Action Data Types ──

export interface SaveMemoryActionData {
  category: "preference" | "injury" | "goal" | "note";
  content: string;
}

// ── Workout Plan Mode Data Types ──

export interface WorkoutOptionExercise {
  name: string;
  sets: number;
  reps: string;
  muscle_group: string;
}

export interface WorkoutOption {
  id: "A" | "B" | "C";
  label: string;
  rationale: string;
  exercises: WorkoutOptionExercise[];
  estimated_duration_min: number;
  intensity: "low" | "moderate" | "high" | "peak";
  primary_muscle_group: string;
}

export interface PresentWorkoutOptionsActionData {
  options: [WorkoutOption, WorkoutOption, WorkoutOption];
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
  /** Latest form analysis report summary (if any) */
  latest_form_report?: {
    report_id: string;
    exercise: string;
    overall_score: number;
    top_issues: string[];
    analyzed_at: string;
  } | null;
  /** Last 1-3 AI-generated Coach's Notes from recent workouts (episodic memory) */
  recent_session_notes?: Array<{
    summary: string;
    key_observations: Record<string, unknown> | null;
    created_at: string;
  }> | null;
  /** Acute:Chronic Workload Ratio (7-day avg / 28-day avg) */
  acwr?: number | null;
  /** ACWR status label */
  acwr_status?: "danger" | "high" | "elevated" | "optimal" | "underloaded" | null;
  /** Current fatigue level label from the fatigue engine */
  fatigue_label?: string | null;
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
  "present_workout_options",
  "show_substitution",
  "show_readiness",
  "show_recovery",
  "show_prescription",
  "show_meal_suggestion",
  "show_macro_breakdown",
  "add_exercise",
  "swap_exercise",
  "add_sets",
  "update_set",
  "remove_exercise",
  "create_and_add_exercise",
  "start_timer",
  "log_quick_meal",
  "create_template",
  "start_workout_from_template",
  "create_program",
  "save_memory",
  "navigate_to",
  "none",
] as const;

export const CoachResponseSchema = z.object({
  // NOTE: No .max() — Anthropic rejects maxLength in structured output schemas.
  // The system prompt instructs the model to keep replies under 120 words.
  reply: z.string(),
  action: z
    .enum(ALL_COACH_ACTIONS)
    .optional().default("none"),
  // Action payload as a JSON string — Anthropic's structured output rejects
  // z.record/z.any/empty schemas, so we serialize action data as a string
  // and parse it on the server side.
  data_json: z.string().optional().default(""),
});

export type CoachResponse = z.infer<typeof CoachResponseSchema>;

// ── Autoregulation Prescription ──

export const AutoregulationPrescriptionSchema = z.object({
  exercise_name: z.string(),
  target_weight_kg: z.number(),
  target_reps: z.number(),
  target_sets: z.number(),
  rationale: z.string(),
  readiness_factor: z.enum(["push", "maintain", "deload"]),
  progressive_overload_pct: z.number(),
});

export type AutoregulationPrescription = z.infer<
  typeof AutoregulationPrescriptionSchema
>;

// ── Destructive Action Confirmation ──

/** Actions that modify or remove existing workout data — require user confirmation */
export const DESTRUCTIVE_ACTIONS: CoachAction[] = [
  "swap_exercise",
  "remove_exercise",
  "update_set",
];

export function isDestructiveAction(action: CoachAction): boolean {
  return DESTRUCTIVE_ACTIONS.includes(action);
}

export interface PendingAction {
  action: CoachAction;
  data: Record<string, unknown> | null;
  description: string;
}
