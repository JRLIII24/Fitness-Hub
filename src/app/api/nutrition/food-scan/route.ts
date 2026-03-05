/**
 * Food Scanner API
 * POST /api/nutrition/food-scan
 *
 * Photograph food → macro estimates with portion review.
 * Replaces /api/nutrition/vision.
 *
 * Model: Sonnet (vision)
 * Runtime: nodejs (NOT edge — Vercel edge has 4MB body limit)
 * Rate limit: 15/day
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
import { FOOD_SCAN_PROMPT } from "@/lib/ai-prompts/vision";
import {
  FoodScanResultSchema,
  type FoodScanResult,
} from "@/lib/food-scanner/types";

const DAILY_LIMIT = 15;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          food_name: { type: "string" },
          assumed_portion: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          estimated_calories: { type: "number" },
          estimated_protein_g: { type: "number" },
          estimated_carbs_g: { type: "number" },
          estimated_fat_g: { type: "number" },
          notes: { type: "string" },
        },
        required: [
          "food_name",
          "assumed_portion",
          "confidence",
          "estimated_calories",
          "estimated_protein_g",
          "estimated_carbs_g",
          "estimated_fat_g",
        ],
      },
    },
    overall_notes: { type: "string" },
  },
  required: ["items"],
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
      `ai:food-scan:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const image: string | undefined = body?.image;
    const description: string | undefined = body?.description;

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

    const descriptionContext = description
      ? `The user describes this as: "${description}"`
      : "No description provided — identify foods from the image alone.";

    const systemPrompt = FOOD_SCAN_PROMPT.replace(
      "{description_context}",
      descriptionContext,
    );

    const mediaType = getImageMediaType(image);

    const result = await callAnthropicWithTool<FoodScanResult>({
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
              text: "Identify each food item and estimate its nutritional content.",
            },
          ],
        },
      ],
      toolName: "food_estimation",
      toolDescription:
        "Estimate nutritional content for each food item in the photo",
      toolSchema: TOOL_SCHEMA,
      zodSchema: FoodScanResultSchema,
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
    logger.error("Food scan API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food" },
      { status: 500 },
    );
  }
}
