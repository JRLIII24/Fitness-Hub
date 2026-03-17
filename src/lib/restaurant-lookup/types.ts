import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
export const RestaurantItemSchema = z.object({
  restaurant_name: z.string(),
  item_name: z.string(),
  serving_description: z.string(),
  serving_size_g: z.number().nullable(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  sugar_g: z.number(),
  sodium_mg: z.number(),
  confidence: z.enum(["published", "estimated"]),
});

export const RestaurantLookupResultSchema = z.object({
  items: z.array(RestaurantItemSchema),
});

export type RestaurantItem = z.infer<typeof RestaurantItemSchema>;
export type RestaurantLookupResult = z.infer<typeof RestaurantLookupResultSchema>;
