/**
 * USDA FoodData Central API client.
 * Searches for foods and returns per-100g macro data.
 *
 * API docs: https://fdc.nal.usda.gov/api-guide
 * Requires env var: USDA_API_KEY (free key from https://fdc.nal.usda.gov/api-key-signup)
 */

import { logger } from "@/lib/logger";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";
const TIMEOUT_MS = 5_000;

const NUTRIENT_IDS = {
  ENERGY: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  FIBER: 1079,
  SUGAR: 2000,
  SODIUM: 1093,
} as const;

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods: UsdaFood[];
  totalHits: number;
}

export interface UsdaMatch {
  fdc_id: number;
  description: string;
  data_source: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  sugar_per_100g: number;
  sodium_per_100g: number;
}

function extractNutrient(nutrients: UsdaNutrient[], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

function parseFood(food: UsdaFood): UsdaMatch {
  return {
    fdc_id: food.fdcId,
    description: food.description,
    data_source: food.dataType,
    calories_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.ENERGY),
    protein_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.PROTEIN),
    carbs_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.CARBS),
    fat_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.FAT),
    fiber_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.FIBER),
    sugar_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.SUGAR),
    sodium_per_100g: extractNutrient(food.foodNutrients, NUTRIENT_IDS.SODIUM),
  };
}

async function fetchSearch(
  query: string,
  apiKey: string,
  dataType?: string,
): Promise<UsdaFood | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      query,
      api_key: apiKey,
      pageSize: "3",
    });
    if (dataType) params.set("dataType", dataType);

    const res = await fetch(`${USDA_BASE}?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data: UsdaSearchResponse = await res.json();
    return data.foods?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search USDA FoodData Central for a food by name.
 * Prefers Survey (FNDDS) data (cooked/prepared foods).
 * Falls back to all data types if no FNDDS results.
 * Returns null if no API key, no results, or on any error.
 */
export async function searchFood(query: string): Promise<UsdaMatch | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  try {
    // Prefer FNDDS (cooked/prepared foods)
    let food = await fetchSearch(query, apiKey, "Survey (FNDDS)");

    // Fallback to all data types
    if (!food) {
      food = await fetchSearch(query, apiKey);
    }

    if (!food) return null;
    return parseFood(food);
  } catch (err) {
    logger.error("USDA search error:", err);
    return null;
  }
}

/**
 * Scale per-100g macro data to a specific portion size in grams.
 */
export function scaleToGrams(
  match: UsdaMatch,
  grams: number,
): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
} {
  const factor = grams / 100;
  return {
    calories: Math.round(match.calories_per_100g * factor),
    protein_g: Math.round(match.protein_per_100g * factor),
    carbs_g: Math.round(match.carbs_per_100g * factor),
    fat_g: Math.round(match.fat_per_100g * factor),
    fiber_g: Math.round(match.fiber_per_100g * factor),
    sugar_g: Math.round(match.sugar_per_100g * factor),
    // USDA reports sodium in mg per 100g, so scale directly
    sodium_mg: Math.round(match.sodium_per_100g * factor),
  };
}
