import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
// Schema for what the AI returns (used with generateObject)
export const FoodEstimationSchema = z.object({
  food_name: z.string(),
  assumed_portion: z.string(),
  estimated_weight_g: z.number(),
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

// Schema for what the API returns to the client (AI result + USDA enrichment)
export const EnrichedFoodEstimationSchema = FoodEstimationSchema.extend({
  usda_match: z
    .object({
      fdc_id: z.number(),
      description: z.string(),
      data_source: z.string(),
    })
    .nullable(),
  source: z.enum(["ai-scan", "usda"]),
});

export const EnrichedFoodScanResultSchema = z.object({
  items: z.array(EnrichedFoodEstimationSchema),
  overall_notes: z.string().optional(),
});

export type FoodEstimation = z.infer<typeof FoodEstimationSchema>;
export type FoodScanResult = z.infer<typeof FoodScanResultSchema>;
export type EnrichedFoodEstimation = z.infer<typeof EnrichedFoodEstimationSchema>;
export type EnrichedFoodScanResult = z.infer<typeof EnrichedFoodScanResultSchema>;
