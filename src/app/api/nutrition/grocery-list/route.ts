/**
 * Grocery List Generator API
 * POST /api/nutrition/grocery-list — Generate from food log
 *
 * Model: Haiku
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { GROCERY_GENERATION_PROMPT } from "@/lib/ai-prompts/grocery";
import {
  GroceryAIOutputSchema,
  type GroceryAIOutput,
} from "@/lib/grocery/types";
import { getUserTimezone } from "@/lib/timezone";

export async function POST() {
  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Fetch aggregated food log summary (SQL does the heavy lifting)
    const { data: foodSummary, error: rpcError } = await supabase.rpc(
      "get_food_log_summary_for_grocery",
      { p_days_back: 14 },
    );

    if (rpcError) {
      logger.error("Grocery RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to fetch food history" },
        { status: 500 },
      );
    }

    if (!foodSummary || foodSummary.length < 3) {
      return NextResponse.json(
        {
          error:
            "Not enough food log data. Log at least 3 different foods over a few days to generate a grocery list.",
        },
        { status: 400 },
      );
    }

    // Build expenditure context from profile goal + recent nutrition adjustments
    let expenditureContext = "No active expenditure adjustment.";
    const { data: profile } = await supabase
      .from("profiles")
      .select("fitness_goal")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.fitness_goal) {
      const { data: recentGoals } = await supabase
        .from("nutrition_goals")
        .select("calories_target, effective_from")
        .eq("user_id", user.id)
        .order("effective_from", { ascending: false })
        .limit(2);

      if (recentGoals && recentGoals.length >= 2) {
        const current = recentGoals[0];
        const previous = recentGoals[1];
        if (current.calories_target && previous.calories_target) {
          const delta = current.calories_target - previous.calories_target;
          if (delta !== 0) {
            const direction = delta > 0 ? "+" : "";
            const goalLabel = profile.fitness_goal.replace("_", " ");
            expenditureContext = `Weekly adjustment: ${direction}${delta} kcal daily (goal: ${goalLabel}). Current target: ${current.calories_target} kcal.`;
          }
        }
      }
    }

    // Format summary for the prompt (compact table)
    const summaryTable = foodSummary
      .map(
        (f: {
          food_name: string;
          total_servings: number;
          avg_daily_servings: number;
          serving_description: string | null;
          times_logged: number;
          meal_types: string[];
        }) =>
          `${f.food_name}: ${f.total_servings} servings over 14d (avg ${f.avg_daily_servings}/day), portion: ${f.serving_description || "standard"}, logged ${f.times_logged}x, meals: ${(f.meal_types || []).join("/")}`,
      )
      .join("\n");

    const systemPrompt = GROCERY_GENERATION_PROMPT.replace(
      "{expenditure_context}",
      expenditureContext,
    ).replace("{food_log_summary}", summaryTable);

    const { object: aiOutput } = await generateObject({
      model: provider(HAIKU),
      schema: GroceryAIOutputSchema,
      system: systemPrompt,
      prompt: "Generate my grocery list for this week based on my eating patterns.",
      maxOutputTokens: 4096,
    });

    // Upsert into grocery_lists
    const timezone = await getUserTimezone(user.id);
    const now = new Date();
    // Get Monday of current week
    const dayOfWeek = now.getDay(); // 0=Sun
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const weekStart = monday.toLocaleDateString("en-CA", {
      timeZone: timezone,
    });

    const { data: grocery, error: upsertError } = await supabase
      .from("grocery_lists")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStart,
          items: aiOutput.categories,
          ai_summary: aiOutput.summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_start" },
      )
      .select("id, week_start, items, ai_summary, created_at, updated_at")
      .single();

    if (upsertError) {
      logger.error("Grocery upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save grocery list" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: grocery.id,
      categories: grocery.items,
      summary: grocery.ai_summary,
      estimated_weekly_calories: aiOutput.estimated_weekly_calories,
      estimated_weekly_protein_g: aiOutput.estimated_weekly_protein_g,
      week_start: grocery.week_start,
      generated_at: grocery.updated_at,
    });
  } catch (error) {
    logger.error("Grocery list API error:", error);
    return NextResponse.json(
      { error: "Failed to generate grocery list" },
      { status: 500 },
    );
  }
}
