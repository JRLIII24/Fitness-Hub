/**
 * Food Log API
 * POST /api/nutrition/food-log
 *
 * Bulk-insert food scan results into food_items + food_log.
 * Server-side to avoid client RLS limitations on food_items.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

const FoodLogItemSchema = z.object({
  food_name: z.string().min(1).max(500),
  calories: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0).optional(),
  sugar_g: z.number().min(0).optional(),
  sodium_mg: z.number().min(0).optional(),
  source: z.enum(["ai-scan", "usda"]).default("ai-scan"),
});

const RequestSchema = z.object({
  items: z.array(FoodLogItemSchema).min(1).max(20),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { items, meal_type } = parsed.data;
    const now = new Date().toISOString();
    const logged: string[] = [];

    for (const item of items) {
      // Insert food_item definition
      const { data: foodItem, error: fiErr } = await supabase
        .from("food_items")
        .insert({
          name: item.food_name,
          calories_per_serving: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g ?? null,
          sugar_g: item.sugar_g ?? null,
          sodium_mg: item.sodium_mg ?? null,
          source: item.source,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (fiErr || !foodItem) {
        logger.error("Failed to insert food_item:", fiErr);
        return NextResponse.json(
          { error: `Failed to save food item "${item.food_name}": ${fiErr?.message ?? "unknown error"}` },
          { status: 500 },
        );
      }

      // Log it
      const { error: flErr } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItem.id,
        meal_type,
        servings: 1,
        calories_consumed: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        logged_at: now,
      });

      if (flErr) {
        logger.error("Failed to insert food_log:", flErr);
        return NextResponse.json(
          { error: `Failed to log "${item.food_name}": ${flErr.message}` },
          { status: 500 },
        );
      }

      logged.push(foodItem.id);
    }

    return NextResponse.json({ logged: logged.length });
  } catch (error) {
    logger.error("Food log API error:", error);
    return NextResponse.json(
      { error: "Failed to log food" },
      { status: 500 },
    );
  }
}
