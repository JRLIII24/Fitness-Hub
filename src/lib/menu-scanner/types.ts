import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
export const MenuRecommendationSchema = z.object({
  name: z.string(),
  reason: z.string(),
  estimated_calories: z.number(),
  estimated_protein_g: z.number(),
  estimated_carbs_g: z.number(),
  estimated_fat_g: z.number(),
  modification_tip: z.string().optional(),
});

export const MenuScanResultSchema = z.object({
  top_3_recommendations: z.array(MenuRecommendationSchema),
  overall_tip: z.string(),
});

export type MenuRecommendation = z.infer<typeof MenuRecommendationSchema>;
export type MenuScanResult = z.infer<typeof MenuScanResultSchema>;
