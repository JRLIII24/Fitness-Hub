import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
export const FoodEstimationSchema = z.object({
  food_name: z.string(),
  assumed_portion: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  estimated_calories: z.number(),
  estimated_protein_g: z.number(),
  estimated_carbs_g: z.number(),
  estimated_fat_g: z.number(),
  notes: z.string().optional(),
});

export const FoodScanResultSchema = z.object({
  items: z.array(FoodEstimationSchema),
  overall_notes: z.string().optional(),
});

export type FoodEstimation = z.infer<typeof FoodEstimationSchema>;
export type FoodScanResult = z.infer<typeof FoodScanResultSchema>;
