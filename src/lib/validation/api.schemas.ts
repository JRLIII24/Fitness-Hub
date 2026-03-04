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

export const exerciseSearchSchema = z.object({
  query: z.string().optional().default(""),
  muscle_groups: z.string().optional().default(""),
  muscle_group: z.string().optional().default(""),
  equipment: z.string().optional().default(""),
  category: z.string().optional().default(""),
  source: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(100),
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
