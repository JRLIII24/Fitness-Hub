import { z } from "zod";

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Profile schemas
export const profileFormSchema = z.object({
  display_name: z.string().min(1, "Name is required").max(100),
  height_cm: z.number().nullable().optional().or(z.nan().transform(() => null)),
  weight_kg: z.number().nullable().optional().or(z.nan().transform(() => null)),
  date_of_birth: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable().optional(),
  fitness_goal: z.enum(["lose_weight", "build_muscle", "maintain", "improve_endurance"]).nullable().optional(),
});

// Nutrition goals schema
export const nutritionGoalsSchema = z.object({
  calories_target: z.number().min(800, "Calories must be at least 800").max(10000),
  protein_g_target: z.number().min(10, "Protein must be at least 10g").max(500),
  carbs_g_target: z.number().min(20, "Carbs must be at least 20g").max(1000),
  fat_g_target: z.number().min(10, "Fat must be at least 10g").max(500),
  fiber_g_target: z.number().min(0, "Fiber must be 0 or more").max(100).optional().nullable(),
});

// Workout template schema
export const saveTemplateSchema = z.object({
  name: z.string().min(2, "Template name must be at least 2 characters").max(100),
});

// Food log schema
export const foodLogSchema = z.object({
  servings: z.number().min(0.1, "Servings must be at least 0.1").max(100),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

// Type exports for use in components
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ProfileFormData = z.infer<typeof profileFormSchema>;
export type NutritionGoalsFormData = z.infer<typeof nutritionGoalsSchema>;
export type SaveTemplateFormData = z.infer<typeof saveTemplateSchema>;
export type FoodLogFormData = z.infer<typeof foodLogSchema>;
