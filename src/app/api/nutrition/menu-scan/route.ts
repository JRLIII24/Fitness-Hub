/**
 * Menu Scanner API
 * POST /api/nutrition/menu-scan
 *
 * Photograph a restaurant menu → top 3 meal recommendations
 * based on remaining daily macros.
 *
 * Model: Sonnet (vision — menu analysis + macro matching)
 * Runtime: nodejs (NOT edge — Vercel edge has 4MB body limit)
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, SONNET } from "@/lib/ai-sdk";
import { MENU_SCAN_PROMPT } from "@/lib/ai-prompts/vision";
import {
  MenuScanResultSchema,
  type MenuScanResult,
} from "@/lib/menu-scanner/types";
import { getUserTimezone } from "@/lib/timezone";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

function extractBase64Data(image: string): string {
  const commaIdx = image.indexOf(",");
  return commaIdx >= 0 ? image.slice(commaIdx + 1) : image;
}

export async function POST(request: Request) {
  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const image: string | undefined = body?.image;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "image is required" },
        { status: 400 },
      );
    }

    // Validate size
    const base64Data = extractBase64Data(image);
    const estimatedBytes = (base64Data.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Image exceeds 4MB limit" },
        { status: 400 },
      );
    }

    // Fetch remaining macros for the day
    const timezone = await getUserTimezone(user.id);
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: timezone,
    });

    const [nutritionResult, goalsResult] = await Promise.all([
      supabase.rpc("get_dashboard_nutrition_summary", {
        p_user_id: user.id,
        p_date_str: todayStr,
      }),
      supabase
        .from("nutrition_goals")
        .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
        .eq("user_id", user.id)
        .single(),
    ]);

    const consumed = nutritionResult.data?.[0] ?? {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
    };
    const goals = goalsResult.data ?? {
      calories_target: 2000,
      protein_g_target: 150,
      carbs_g_target: 250,
      fat_g_target: 65,
    };

    const remaining = {
      calories: Math.max(0, (goals.calories_target ?? 2000) - (consumed.total_calories ?? 0)),
      protein_g: Math.max(
        0,
        (goals.protein_g_target ?? 150) - (consumed.total_protein_g ?? 0),
      ),
      carbs_g: Math.max(0, (goals.carbs_g_target ?? 250) - (consumed.total_carbs_g ?? 0)),
      fat_g: Math.max(0, (goals.fat_g_target ?? 65) - (consumed.total_fat_g ?? 0)),
    };

    const systemPrompt = MENU_SCAN_PROMPT.replace(
      "{remaining_macros}",
      `Calories: ${remaining.calories} remaining\nProtein: ${remaining.protein_g}g remaining\nCarbs: ${remaining.carbs_g}g remaining\nFat: ${remaining.fat_g}g remaining`,
    );


    const { object } = await generateObject({
      model: provider(SONNET),
      schema: MenuScanResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)),
            },
            {
              type: "text",
              text: "Analyze this menu and recommend the best options for my remaining macros.",
            },
          ],
        },
      ],
      maxOutputTokens: 2048,
    });

    return NextResponse.json(object);
  } catch (error) {
    logger.error("Menu scan API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu" },
      { status: 500 },
    );
  }
}
