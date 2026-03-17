/**
 * Restaurant Item Lookup API
 * GET /api/nutrition/restaurant-search?q=...
 *
 * Uses Haiku to look up published nutrition data from restaurant chains.
 * Returns results in FoodItem shape for direct use with FoodLogForm.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { RESTAURANT_LOOKUP_PROMPT } from "@/lib/ai-prompts/vision";
import { RestaurantLookupResultSchema } from "@/lib/restaurant-lookup/types";
import type { RestaurantItem } from "@/lib/restaurant-lookup/types";

function toFoodItem(item: RestaurantItem, index: number) {
  return {
    id: `restaurant-${Date.now()}-${index}`,
    barcode: null,
    name: item.item_name,
    brand: item.restaurant_name,
    serving_size_g: item.serving_size_g,
    serving_description: item.serving_description,
    calories_per_serving: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
    sugar_g: item.sugar_g,
    sodium_mg: item.sodium_mg,
    source: "nutritionix" as const,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 },
    );
  }

  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json(
        { error: "AI unavailable" },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { object } = await generateObject({
      model: provider(HAIKU),
      schema: RestaurantLookupResultSchema,
      system: RESTAURANT_LOOKUP_PROMPT,
      prompt: `Find restaurant menu items matching: "${q.trim()}"`,
      maxOutputTokens: 1024,
    });

    const items = object.items.map(toFoodItem);
    return NextResponse.json(items);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Restaurant search failed";
    logger.error("Restaurant search error:", message, err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
