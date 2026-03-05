import { z } from "zod";

export const MenuRecommendationSchema = z.object({
  name: z.string().max(200),
  reason: z.string().max(500),
  estimated_calories: z.number().min(0).max(5000),
  estimated_protein_g: z.number().min(0).max(500),
  estimated_carbs_g: z.number().min(0).max(1000),
  estimated_fat_g: z.number().min(0).max(500),
  modification_tip: z.string().max(500).optional(),
});

export const MenuScanResultSchema = z.object({
  top_3_recommendations: z.array(MenuRecommendationSchema).max(5),
  overall_tip: z.string().max(500),
});

export type MenuRecommendation = z.infer<typeof MenuRecommendationSchema>;
export type MenuScanResult = z.infer<typeof MenuScanResultSchema>;
