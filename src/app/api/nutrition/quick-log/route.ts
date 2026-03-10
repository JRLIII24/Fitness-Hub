/**
 * Quick Meal Log API
 * POST /api/nutrition/quick-log
 *
 * AI estimates macros from a text description, then creates
 * food_items + food_log entries. Used by the coach's log_quick_meal action.
 *
 * Model: Haiku (fast estimation)
 * Rate limit: 15/day
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";

const DAILY_LIMIT = 15;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const RequestSchema = z.object({
  description: z.string().min(1).max(500),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
});

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
const FoodItemSchema = z.object({
  food_name: z.string(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

const EstimationSchema = z.object({
  items: z.array(FoodItemSchema),
});

const SYSTEM_PROMPT = `You are a nutrition estimation assistant. Given a text description of a meal or food, estimate the macronutrient content for each distinct food item.

Rules:
- Break the description into individual food items
- Estimate a reasonable single-serving portion size
- Provide calories, protein_g, carbs_g, fat_g for each item
- Use standard USDA-like values for common foods
- If the description is vague (e.g., "a sandwich"), assume a typical portion
- Be conservative with estimates — slightly under is better than over
- Maximum 10 items per description`;

export async function POST(request: Request) {
  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(
      `ai:quick-log:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { description, meal_type } = parsed.data;

    // Call Haiku to estimate macros
    const { object: estimation } = await generateObject({
      model: provider(HAIKU),
      schema: EstimationSchema,
      system: SYSTEM_PROMPT,
      prompt: `Estimate the macros for this meal: ${description}`,
      maxOutputTokens: 512,
    });

    const { items } = estimation;
    const now = new Date().toISOString();
    const loggedItems: Array<{ food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }> = [];

    for (const item of items) {
      const { data: foodItem, error: fiErr } = await supabase
        .from("food_items")
        .insert({
          name: item.food_name,
          calories_per_serving: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: "ai-scan",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (fiErr || !foodItem) {
        logger.error("Quick-log food_item insert failed:", fiErr);
        continue;
      }

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
        logger.error("Quick-log food_log insert failed:", flErr);
        continue;
      }

      loggedItems.push(item);
    }

    return NextResponse.json({
      logged: loggedItems.length,
      items: loggedItems,
    });
  } catch (error) {
    logger.error("Quick-log API error:", error);
    return NextResponse.json(
      { error: "Failed to log meal" },
      { status: 500 },
    );
  }
}
