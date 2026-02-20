import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface OFFSearchProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  code?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal_serving"?: number;
    "energy-kcal"?: number;
    "energy-kj_100g"?: number;
    "energy-kj_serving"?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
    fiber_100g?: number;
    fiber_serving?: number;
    sodium_100g?: number;
    sodium_serving?: number;
    salt_100g?: number;
    salt_serving?: number;
    sugars_100g?: number;
    sugars_serving?: number;
  };
  nutrition_data_per?: string;
}

interface OFFSearchResponse {
  count?: number;
  products?: OFFSearchProduct[];
}

interface NormalizedFoodItem {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  serving_size_g: number | null;
  serving_description: string | null;
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g?: number | null;
  sodium_mg: number | null;
  source: string | null;
  created_at?: string;
  created_by?: string | null;
}

function macroPerServing(
  per100: number | undefined,
  perServing: number | undefined,
  servingSizeG: number | null,
  nutritionDataPer: string
): number | null {
  if (perServing != null) return Math.round(perServing * 100) / 100;
  if (nutritionDataPer === "serving" && per100 != null) {
    return Math.round(per100 * 100) / 100;
  }
  if (per100 != null && servingSizeG != null) {
    return Math.round(((per100 * servingSizeG) / 100) * 100) / 100;
  }
  return null;
}

function normalizeOFFProduct(product: OFFSearchProduct): NormalizedFoodItem | null {
  const name =
    product.product_name_en?.trim() || product.product_name?.trim();
  if (!name) return null;

  const nutriments = product.nutriments ?? {};
  const nutritionDataPer = (product.nutrition_data_per ?? "").toLowerCase();
  const brand = product.brands?.split(",")[0]?.trim() || null;

  const servingQuantity =
    typeof product.serving_quantity === "number"
      ? product.serving_quantity
      : typeof product.serving_quantity === "string"
      ? Number.parseFloat(product.serving_quantity.replace(",", "."))
      : null;

  const parsedFromServingSize = (() => {
    const text = product.serving_size?.trim() ?? "";
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|ml|mL)\b/i);
    if (!match) return null;
    const value = Number.parseFloat(match[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  })();

  const servingSizeG =
    servingQuantity != null && Number.isFinite(servingQuantity) && servingQuantity > 0
      ? servingQuantity
      : parsedFromServingSize;

  let calories: number | null = null;
  if (nutriments["energy-kcal_serving"] != null) {
    calories = nutriments["energy-kcal_serving"];
  } else if (
    nutritionDataPer === "serving" &&
    nutriments["energy-kcal_100g"] != null
  ) {
    calories = nutriments["energy-kcal_100g"];
  } else if (nutriments["energy-kcal_100g"] != null && servingSizeG != null) {
    calories = (nutriments["energy-kcal_100g"] * servingSizeG) / 100;
  } else if (nutriments["energy-kj_serving"] != null) {
    calories = nutriments["energy-kj_serving"] / 4.184;
  } else if (
    nutritionDataPer === "serving" &&
    nutriments["energy-kj_100g"] != null
  ) {
    calories = nutriments["energy-kj_100g"] / 4.184;
  } else if (nutriments["energy-kj_100g"] != null && servingSizeG != null) {
    calories = (nutriments["energy-kj_100g"] * servingSizeG) / 100 / 4.184;
  } else if (nutriments["energy-kcal"] != null) {
    calories = nutriments["energy-kcal"];
  }

  const protein_g = macroPerServing(
    nutriments.proteins_100g,
    nutriments.proteins_serving,
    servingSizeG,
    nutritionDataPer
  );
  const carbs_g = macroPerServing(
    nutriments.carbohydrates_100g,
    nutriments.carbohydrates_serving,
    servingSizeG,
    nutritionDataPer
  );
  const fat_g = macroPerServing(
    nutriments.fat_100g,
    nutriments.fat_serving,
    servingSizeG,
    nutritionDataPer
  );
  const fiber_g = macroPerServing(
    nutriments.fiber_100g,
    nutriments.fiber_serving,
    servingSizeG,
    nutritionDataPer
  );
  const sugar_g = macroPerServing(
    nutriments.sugars_100g,
    nutriments.sugars_serving,
    servingSizeG,
    nutritionDataPer
  );

  let sodium_mg: number | null = null;
  if (nutriments.sodium_serving != null) {
    sodium_mg = Math.round(nutriments.sodium_serving * 1000);
  } else if (nutriments.salt_serving != null) {
    sodium_mg = Math.round((nutriments.salt_serving * 1000) / 2.5);
  } else if (
    nutritionDataPer === "serving" &&
    nutriments.sodium_100g != null
  ) {
    sodium_mg = Math.round(nutriments.sodium_100g * 1000);
  } else if (
    nutritionDataPer === "serving" &&
    nutriments.salt_100g != null
  ) {
    sodium_mg = Math.round((nutriments.salt_100g * 1000) / 2.5);
  } else if (nutriments.sodium_100g != null && servingSizeG != null) {
    sodium_mg = Math.round((nutriments.sodium_100g * servingSizeG * 1000) / 100);
  } else if (nutriments.salt_100g != null && servingSizeG != null) {
    sodium_mg = Math.round((nutriments.salt_100g * servingSizeG * 1000) / 100 / 2.5);
  }

  return {
    id: `off-${product.code ?? crypto.randomUUID()}`,
    barcode: product.code ?? null,
    name,
    brand,
    serving_size_g: servingSizeG,
    serving_description: product.serving_size?.trim() || null,
    calories_per_serving:
      calories != null ? Math.round(calories * 100) / 100 : 0,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sugar_g,
    sodium_mg,
    source: "openfoodfacts",
    created_at: new Date().toISOString(),
    created_by: null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const query = q.trim();

  try {
    const supabase = await createClient();

    // Auth check — must be logged in to search food
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Search local food_items table
    const { data: localResults, error: localError } = await supabase
      .from("food_items")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(10);

    if (localError) {
      console.error("Local search error:", localError);
    }

    const local = (localResults ?? []) as NormalizedFoodItem[];

    // 2. Search Open Food Facts
    let remoteResults: NormalizedFoodItem[] = [];
    try {
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        query
      )}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,product_name_en,brands,serving_size,serving_quantity,nutrition_data_per,code,nutriments`;

      const offRes = await fetch(offUrl, {
        headers: {
          "User-Agent": "FitHub/1.0 (nutrition tracker; contact@fithub.app)",
        },
        next: { revalidate: 300 }, // cache for 5 minutes
      });

      if (offRes.ok) {
        const offData: OFFSearchResponse = await offRes.json();
        const products = offData.products ?? [];

        remoteResults = products
          .map(normalizeOFFProduct)
          .filter((item): item is NormalizedFoodItem => item !== null)
          .filter((item) => item.calories_per_serving > 0);
      }
    } catch (offErr) {
      console.error("Open Food Facts search error:", offErr);
      // Continue with local results only
    }

    // 3. Merge: local first, then remote, deduplicated by normalized name
    const seen = new Set<string>();
    const merged: NormalizedFoodItem[] = [];

    for (const item of local) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    for (const item of remoteResults) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // 4. Persist remote results (OFF) to food_items table before returning
    // This ensures they have real database UUIDs for FK constraint when logging
    const itemsToInsert = merged.slice(0, 20).map((item) => {
      // Only insert if from OFF (source === "openfoodfacts") and not already in local results
      if (item.source === "openfoodfacts") {
        return {
          barcode: item.barcode,
          name: item.name,
          brand: item.brand,
          serving_size_g: item.serving_size_g,
          serving_description: item.serving_description,
          calories_per_serving: item.calories_per_serving,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g,
          sugar_g: item.sugar_g,
          sodium_mg: item.sodium_mg,
          source: "openfoodfacts",
        };
      }
      return null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    // Upsert: if barcode exists, skip; if no barcode, use name+brand combo for dedup
    if (itemsToInsert.length > 0) {
      for (const item of itemsToInsert) {
        try {
          if (item.barcode) {
            // Upsert by barcode
            await supabase
              .from("food_items")
              .upsert(item, { onConflict: "barcode" });
          } else {
            // Try insert; if FK/constraint fails, silently ignore (item exists)
            await supabase
              .from("food_items")
              .insert(item)
              .select();
          }
        } catch {
          // Suppress duplicate key or other errors
        }
      }

      // Re-fetch merged results with real IDs from database
      const { data: dbResults } = await supabase
        .from("food_items")
        .select("*")
        .ilike("name", `%${query}%`)
        .limit(20);

      if (dbResults && dbResults.length > 0) {
        return NextResponse.json(dbResults);
      }
    }

    // Never return transient OFF ids; only return persisted DB rows
    return NextResponse.json(local.slice(0, 20));
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
