/**
 * Meal Plan Days API
 * POST   /api/nutrition/meal-plan/[planId]/days – add a food entry to a day
 * DELETE /api/nutrition/meal-plan/[planId]/days – remove an entry
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse";
import { mealPlanDayEntryCreateSchema, mealPlanDayEntryDeleteSchema } from "@/lib/validation/api.schemas";

async function verifyPlanOwnership(supabase: any, planId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const owned = await verifyPlanOwnership(supabase, planId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const parsed = parsePayload(mealPlanDayEntryCreateSchema, await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
    }
    const { day_of_week, meal_type, food_item_id, custom_name, servings, calories, protein_g, carbs_g, fat_g } = parsed.data;

    // If food_item_id provided but no calories, snapshot from food_items
    let resolvedCalories = calories ?? null;
    let resolvedProtein = protein_g ?? null;
    let resolvedCarbs = carbs_g ?? null;
    let resolvedFat = fat_g ?? null;

    if (food_item_id && resolvedCalories == null) {
      const { data: foodItem } = await supabase
        .from("food_items")
        .select("calories_per_serving, protein_g, carbs_g, fat_g")
        .eq("id", food_item_id)
        .single();

      if (foodItem) {
        resolvedCalories = (foodItem.calories_per_serving ?? 0) * servings;
        resolvedProtein = (foodItem.protein_g ?? 0) * servings;
        resolvedCarbs = (foodItem.carbs_g ?? 0) * servings;
        resolvedFat = (foodItem.fat_g ?? 0) * servings;
      }
    }

    const { data, error } = await (supabase as any)
      .from("meal_plan_days")
      .insert({
        plan_id: planId,
        day_of_week,
        meal_type,
        food_item_id: food_item_id ?? null,
        custom_name: custom_name ?? null,
        servings,
        calories: resolvedCalories,
        protein_g: resolvedProtein,
        carbs_g: resolvedCarbs,
        fat_g: resolvedFat,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    logger.error("POST /api/nutrition/meal-plan/[planId]/days error:", error);
    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const owned = await verifyPlanOwnership(supabase, planId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const parsed = parsePayload(mealPlanDayEntryDeleteSchema, await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
    }

    // RLS enforces ownership at DB level too
    const { error } = await (supabase as any)
      .from("meal_plan_days")
      .delete()
      .eq("id", parsed.data.entry_id)
      .eq("plan_id", planId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/nutrition/meal-plan/[planId]/days error:", error);
    return NextResponse.json({ error: "Failed to remove entry" }, { status: 500 });
  }
}
