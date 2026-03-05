/**
 * Grocery List Generator API
 * POST /api/nutrition/grocery-list — Generate from food log
 *
 * Model: Sonnet
 * Rate limit: 5/day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  getAnthropicClient,
  ANTHROPIC_SONNET,
} from "@/lib/anthropic-client";
import { callAnthropicWithTool } from "@/lib/anthropic-helper";
import { GROCERY_GENERATION_PROMPT } from "@/lib/ai-prompts/grocery";
import {
  GroceryAIOutputSchema,
  type GroceryAIOutput,
} from "@/lib/grocery/types";
import { getUserTimezone } from "@/lib/timezone";

const DAILY_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    categories: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          items: {
            type: "array",
            maxItems: 30,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "string" },
                unit: { type: "string" },
                note: { type: "string" },
                checked: { type: "boolean" },
              },
              required: ["name", "quantity", "unit"],
            },
          },
        },
        required: ["category", "items"],
      },
    },
    summary: { type: "string" },
    estimated_weekly_calories: { type: "number" },
    estimated_weekly_protein_g: { type: "number" },
  },
  required: ["categories", "summary"],
};

export async function POST() {
  try {
    const client = getAnthropicClient();
    if (!client) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(
      `ai:grocery:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

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
      "{food_log_summary}",
      summaryTable,
    );

    const result = await callAnthropicWithTool<GroceryAIOutput>({
      client,
      model: ANTHROPIC_SONNET,
      systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Generate my grocery list for this week based on my eating patterns.",
        },
      ],
      toolName: "grocery_list",
      toolDescription:
        "Generate a categorized grocery shopping list from food log patterns",
      toolSchema: TOOL_SCHEMA,
      zodSchema: GroceryAIOutputSchema,
      maxTokens: 4096,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error ?? "AI returned no data" },
        { status: result.status ?? 500 },
      );
    }

    const aiOutput = result.data;

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
