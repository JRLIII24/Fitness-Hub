import { z } from "zod";

export const FoodEstimationSchema = z.object({
  food_name: z.string().max(500),
  assumed_portion: z.string().max(200),
  confidence: z.enum(["high", "medium", "low"]),
  estimated_calories: z.number().min(0).max(10000),
  estimated_protein_g: z.number().min(0).max(500),
  estimated_carbs_g: z.number().min(0).max(1000),
  estimated_fat_g: z.number().min(0).max(500),
  notes: z.string().max(1000).optional(),
});

export const FoodScanResultSchema = z.object({
  items: z.array(FoodEstimationSchema).max(20),
  overall_notes: z.string().max(1000).optional(),
});

export type FoodEstimation = z.infer<typeof FoodEstimationSchema>;
export type FoodScanResult = z.infer<typeof FoodScanResultSchema>;
