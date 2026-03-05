import { z } from "zod";

export const GroceryItemSchema = z.object({
  name: z.string().max(200),
  quantity: z.string().max(50),
  unit: z.string().max(30),
  note: z.string().max(200).optional(),
  checked: z.boolean().default(false),
});

export const GroceryCategorySchema = z.object({
  category: z.string().max(50),
  items: z.array(GroceryItemSchema).max(30),
});

export const GroceryAIOutputSchema = z.object({
  categories: z.array(GroceryCategorySchema).max(12),
  summary: z.string().max(300),
  estimated_weekly_calories: z.number().min(0).optional(),
  estimated_weekly_protein_g: z.number().min(0).optional(),
});

export const GroceryPatchSchema = z.object({
  items: z.array(GroceryCategorySchema).max(12),
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
