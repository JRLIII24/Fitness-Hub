import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
export const GroceryItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  note: z.string().optional(),
  checked: z.boolean().default(false),
});

export const GroceryCategorySchema = z.object({
  category: z.string(),
  items: z.array(GroceryItemSchema),
});

export const GroceryAIOutputSchema = z.object({
  categories: z.array(GroceryCategorySchema),
  summary: z.string(),
  estimated_weekly_calories: z.number().optional(),
  estimated_weekly_protein_g: z.number().optional(),
});

export const GroceryPatchSchema = z.object({
  items: z.array(GroceryCategorySchema),
});

export type GroceryItem = z.infer<typeof GroceryItemSchema>;
export type GroceryCategory = z.infer<typeof GroceryCategorySchema>;
export type GroceryAIOutput = z.infer<typeof GroceryAIOutputSchema>;

export interface GroceryListResult {
  id: string;
  categories: GroceryCategory[];
  summary: string;
  estimated_weekly_calories?: number;
  estimated_weekly_protein_g?: number;
  week_start: string;
  generated_at: string;
}
