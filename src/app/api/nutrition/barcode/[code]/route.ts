import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface OpenFoodFactsNutriments {
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
}

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutrition_data_per?: string;
  nutriments?: OpenFoodFactsNutriments;
}

interface OpenFoodFactsResponse {
  status: number;
  status_verbose?: string;
  product?: OpenFoodFactsProduct;
}

function parseOFFProduct(
  product: OpenFoodFactsProduct,
  barcode: string
): {
  barcode: string;
  name: string;
  brand: string | null;
  serving_size_g: number | null;
  serving_description: string | null;
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: string;
} {
  const nutriments = product.nutriments ?? {};
  const nutritionDataPer = (product.nutrition_data_per ?? "").toLowerCase();
  const name =
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    "Unknown Product";
  const brand = product.brands?.split(",")[0]?.trim() || null;

  // Serving size
  function parseServingSizeG(): number | null {
    const rawQuantity =
      typeof product.serving_quantity === "number"
        ? product.serving_quantity
        : typeof product.serving_quantity === "string"
        ? Number.parseFloat(product.serving_quantity.replace(",", "."))
        : null;

    if (rawQuantity != null && Number.isFinite(rawQuantity) && rawQuantity > 0) {
      return rawQuantity;
    }

    const text = product.serving_size?.trim() ?? "";
    if (!text) return null;

    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|ml|mL)\b/i);
    if (!match) return null;

    const value = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;

    // Approximate ml as g when density is unavailable.
    return value;
  }

  const servingSizeG = parseServingSizeG();
  const servingDescription = product.serving_size?.trim() || null;

  // Calories: prefer explicit per-serving, fallback to scaled per-100g.
  // If OFF says nutrition data is per serving, treat per-100g field as serving value.
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
  } else if (nutriments["energy-kcal_100g"] != null) {
    calories = null;
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

  function macroPerServing(
    per100: number | undefined,
    perServing: number | undefined
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

  const protein_g = macroPerServing(
    nutriments.proteins_100g,
    nutriments.proteins_serving
  );
  const carbs_g = macroPerServing(
    nutriments.carbohydrates_100g,
    nutriments.carbohydrates_serving
  );
  const fat_g = macroPerServing(nutriments.fat_100g, nutriments.fat_serving);
  const fiber_g = macroPerServing(
    nutriments.fiber_100g,
    nutriments.fiber_serving
  );
  const sugar_g = macroPerServing(
    nutriments.sugars_100g,
    nutriments.sugars_serving
  );

  // Sodium: convert from g to mg.
  // If sodium is missing, derive from salt using sodium = salt / 2.5.
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
    barcode,
    name,
    brand,
    serving_size_g: servingSizeG,
    serving_description: servingDescription,
    calories_per_serving:
      calories != null ? Math.round(calories * 100) / 100 : 0,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sugar_g,
    sodium_mg,
    source: "openfoodfacts",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.trim().length === 0) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
  }

  const barcode = code.trim();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    const supabase = await createClient();

    // Auth check — must be logged in to look up barcodes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check local database first
    const { data: existingItem, error: dbError } = await supabase
      .from("food_items")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();

    if (dbError) {
      console.error("DB lookup error:", dbError);
    }

    if (existingItem && !refresh) {
      return NextResponse.json(existingItem);
    }

    // 2. Fetch from Open Food Facts
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;

    const offRes = await fetch(offUrl, {
      headers: {
        "User-Agent": "FitHub/1.0 (nutrition tracker; contact@fithub.app)",
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!offRes.ok) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const offData: OpenFoodFactsResponse = await offRes.json();

    if (offData.status !== 1 || !offData.product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const product = offData.product;
    const productName =
      product.product_name_en?.trim() || product.product_name?.trim();

    if (!productName) {
      return NextResponse.json(
        { error: "Product found but has no name" },
        { status: 404 }
      );
    }

    // 3. Parse and store in DB
    const parsed = parseOFFProduct(product, barcode);

    const { data: inserted, error: insertError } = existingItem
      ? await supabase
          .from("food_items")
          .update(parsed)
          .eq("id", existingItem.id)
          .select("*")
          .single()
      : await supabase
          .from("food_items")
          .insert(parsed)
          .select("*")
          .single();

    if (insertError) {
      console.error("Failed to store food item:", insertError);
      return NextResponse.json(
        { error: "Failed to save product for logging" },
        { status: 500 }
      );
    }

    return NextResponse.json(inserted);
  } catch (err) {
    console.error("Barcode lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
