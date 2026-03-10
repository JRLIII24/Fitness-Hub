import { z } from "zod";

// ── Body Weight ───────────────────────────────────────────────────────────────

export const bodyWeightCreateSchema = z.object({
  logged_date: z.string().min(1, "Date is required"),
  weight_kg: z.number().positive("Weight must be positive"),
  body_fat_pct: z.number().min(0).max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const bodyWeightUpdateSchema = bodyWeightCreateSchema.extend({
  id: z.string().uuid("Invalid record ID"),
});

export type BodyWeightCreate = z.infer<typeof bodyWeightCreateSchema>;
export type BodyWeightUpdate = z.infer<typeof bodyWeightUpdateSchema>;

// ── Exercises ─────────────────────────────────────────────────────────────────

const VALID_MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quadriceps", "hamstrings", "glutes", "calves", "abs", "obliques",
  "traps", "lats", "lower_back", "hip_flexors", "adductors", "abductors",
  "neck", "full_body", "cardio", "other",
] as const;

const VALID_EQUIPMENT = [
  "barbell", "dumbbell", "kettlebell", "machine", "cable",
  "bodyweight", "band", "smith_machine", "other", "none",
] as const;

const VALID_CATEGORIES = [
  "compound", "isolation", "cardio", "stretching", "plyometric", "other",
] as const;

export const exerciseCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  muscle_group: z.enum(VALID_MUSCLE_GROUPS),
  equipment: z.enum(VALID_EQUIPMENT),
  category: z.enum(VALID_CATEGORIES),
  instructions: z.string().max(2000).optional(),
});

export type ExerciseCreate = z.infer<typeof exerciseCreateSchema>;

// ── Pod Messages ──────────────────────────────────────────────────────────────

export const podMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(280),
  recipient_id: z.string().uuid().optional(),
});

export type PodMessage = z.infer<typeof podMessageSchema>;

// ── Pod Invite ────────────────────────────────────────────────────────────────

export const podInviteSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});

export type PodInvite = z.infer<typeof podInviteSchema>;

// ── Invite Response ───────────────────────────────────────────────────────────

export const inviteResponseSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export type InviteResponse = z.infer<typeof inviteResponseSchema>;

// ── AI Parse Set ──────────────────────────────────────────────────────────────

export const parseSetSchema = z.object({
  transcript: z.string().trim().min(1, "Transcript is required"),
});

export type ParseSetInput = z.infer<typeof parseSetSchema>;

// ── Template Discover (query params) ──────────────────────────────────────────

export const discoverQuerySchema = z.object({
  search: z.string().optional().default(""),
  muscle_groups: z.string().optional().default(""),
  sort: z.enum(["save_count", "trending", "newest", "rating"]).optional().default("save_count"),
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(50).optional().default(20),
  tab: z.enum(["community", "mine"]).optional().default("community"),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

// ── Nutrition Search (query params) ───────────────────────────────────────────

export const nutritionSearchSchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
});

export type NutritionSearchQuery = z.infer<typeof nutritionSearchSchema>;

// ── Exercise Search (query params) ────────────────────────────────────────────

/**
 * Valid values for the `source` filter on the exercises table.
 *
 * "free-exercise-db" — exercises seeded from the yuhonas/free-exercise-db repo
 * "custom"           — user-created exercises (exercises.is_custom = true)
 *
 * Keeping this as an explicit enum (rather than z.string()) prevents callers
 * from probing arbitrary source values against the database, which could be
 * used to enumerate internal data categories or cause unexpected query plans.
 *
 * When a new source type is introduced (e.g. from a new import pipeline),
 * add it here and update the exercise creation route accordingly.
 */
const VALID_EXERCISE_SOURCES = ["free-exercise-db", "custom"] as const;

export const exerciseSearchSchema = z.object({
  query: z.string().optional().default(""),
  muscle_groups: z.string().optional().default(""),
  muscle_group: z.string().optional().default(""),
  equipment: z.string().optional().default(""),
  category: z.string().optional().default(""),

  // Strict enum — rejects arbitrary strings; omitting the field returns all sources
  source: z.enum(VALID_EXERCISE_SOURCES).optional(),

  // Cap at 200: sufficient for paginated UI (largest known page size is 50).
  // The previous max of 10,000 allowed a single request to stream the entire
  // exercises table, constituting a lightweight DoS / data-exfiltration vector.
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export type ExerciseSearchQuery = z.infer<typeof exerciseSearchSchema>;

// ── Pro Waitlist ──────────────────────────────────────────────────────────────

export const waitlistJoinSchema = z.object({
  email: z.string().email("Valid email required"),
});

export type WaitlistJoin = z.infer<typeof waitlistJoinSchema>;

// ── Body Measurements ────────────────────────────────────────────────────────

export const bodyMeasurementCreateSchema = z.object({
  measured_date: z.string().min(1, "Date is required"),
  waist_cm: z.number().positive().nullable().optional(),
  chest_cm: z.number().positive().nullable().optional(),
  hips_cm: z.number().positive().nullable().optional(),
  left_arm_cm: z.number().positive().nullable().optional(),
  right_arm_cm: z.number().positive().nullable().optional(),
  left_thigh_cm: z.number().positive().nullable().optional(),
  right_thigh_cm: z.number().positive().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const bodyMeasurementUpdateSchema = bodyMeasurementCreateSchema.extend({
  id: z.string().uuid("Invalid record ID"),
});

export type BodyMeasurementCreate = z.infer<typeof bodyMeasurementCreateSchema>;
export type BodyMeasurementUpdate = z.infer<typeof bodyMeasurementUpdateSchema>;

// ── Meal Templates ───────────────────────────────────────────────────────────

const mealTemplateItemSchema = z.object({
  food_item_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).nullable().optional(),
  servings: z.number().positive(),
  calories: z.number().min(0),
  protein_g: z.number().min(0).nullable().optional(),
  carbs_g: z.number().min(0).nullable().optional(),
  fat_g: z.number().min(0).nullable().optional(),
});

export const mealTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  items: z.array(mealTemplateItemSchema).min(1, "At least one item required").max(30),
});

export type MealTemplateCreate = z.infer<typeof mealTemplateCreateSchema>;

// ── Meal Plans ────────────────────────────────────────────────────────────────

export const mealPlanCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  notes: z.string().max(500).nullable().optional(),
});

export const mealPlanDayEntryCreateSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  food_item_id: z.string().uuid().nullable().optional(),
  custom_name: z.string().max(200).nullable().optional(),
  servings: z.number().positive().max(99),
  calories: z.number().min(0).nullable().optional(),
  protein_g: z.number().min(0).nullable().optional(),
  carbs_g: z.number().min(0).nullable().optional(),
  fat_g: z.number().min(0).nullable().optional(),
}).refine(
  (d) => d.food_item_id != null || (d.custom_name != null && d.custom_name.length > 0),
  { message: "Either food_item_id or custom_name is required" }
);

export const mealPlanDayEntryDeleteSchema = z.object({
  entry_id: z.string().uuid("Invalid entry ID"),
});

export type MealPlanCreate = z.infer<typeof mealPlanCreateSchema>;
export type MealPlanDayEntryCreate = z.infer<typeof mealPlanDayEntryCreateSchema>;
export type MealPlanDayEntryDelete = z.infer<typeof mealPlanDayEntryDeleteSchema>;
