/**
 * Menu Scanner API
 * POST /api/nutrition/menu-scan
 *
 * Photograph a restaurant menu → top 3 meal recommendations
 * based on remaining daily macros.
 *
 * Model: Sonnet (vision)
 * Runtime: nodejs (NOT edge — Vercel edge has 4MB body limit)
 * Rate limit: 10/day
 */

export const runtime = "nodejs";

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
import { MENU_SCAN_PROMPT } from "@/lib/ai-prompts/vision";
import {
  MenuScanResultSchema,
  type MenuScanResult,
} from "@/lib/menu-scanner/types";
import { getUserTimezone } from "@/lib/timezone";

const DAILY_LIMIT = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    top_3_recommendations: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          estimated_calories: { type: "number" },
          estimated_protein_g: { type: "number" },
          estimated_carbs_g: { type: "number" },
          estimated_fat_g: { type: "number" },
          modification_tip: { type: "string" },
        },
        required: [
          "name",
          "reason",
          "estimated_calories",
          "estimated_protein_g",
          "estimated_carbs_g",
          "estimated_fat_g",
        ],
      },
    },
    overall_tip: { type: "string" },
  },
  required: ["top_3_recommendations", "overall_tip"],
};

function getImageMediaType(
  image: string,
): "image/jpeg" | "image/png" | "image/webp" {
  if (image.startsWith("data:image/png")) return "image/png";
  if (image.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

function extractBase64Data(image: string): string {
  const commaIdx = image.indexOf(",");
  return commaIdx >= 0 ? image.slice(commaIdx + 1) : image;
}

export async function POST(request: Request) {
  try {
    const client = getAnthropicClient();
    if (!client) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(
      `ai:menu-scan:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

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
        .select("calories, protein_g, carbs_g, fat_g")
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
      calories: 2000,
      protein_g: 150,
      carbs_g: 250,
      fat_g: 65,
    };

    const remaining = {
      calories: Math.max(0, goals.calories - (consumed.total_calories ?? 0)),
      protein_g: Math.max(
        0,
        goals.protein_g - (consumed.total_protein_g ?? 0),
      ),
      carbs_g: Math.max(0, goals.carbs_g - (consumed.total_carbs_g ?? 0)),
      fat_g: Math.max(0, goals.fat_g - (consumed.total_fat_g ?? 0)),
    };

    const systemPrompt = MENU_SCAN_PROMPT.replace(
      "{remaining_macros}",
      `Calories: ${remaining.calories} remaining\nProtein: ${remaining.protein_g}g remaining\nCarbs: ${remaining.carbs_g}g remaining\nFat: ${remaining.fat_g}g remaining`,
    );

    const mediaType = getImageMediaType(image);

    const result = await callAnthropicWithTool<MenuScanResult>({
      client,
      model: ANTHROPIC_SONNET,
      systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Analyze this menu and recommend the best options for my remaining macros.",
            },
          ],
        },
      ],
      toolName: "menu_recommendations",
      toolDescription:
        "Provide menu recommendations based on nutritional analysis",
      toolSchema: TOOL_SCHEMA,
      zodSchema: MenuScanResultSchema,
      maxTokens: 2048,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error("Menu scan API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu" },
      { status: 500 },
    );
  }
}
