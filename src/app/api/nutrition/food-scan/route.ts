/**
 * Food Scanner API
 * POST /api/nutrition/food-scan
 *
 * Photograph food → macro estimates with portion review.
 * Replaces /api/nutrition/vision.
 *
 * Model: Sonnet (vision — accurate macro estimation)
 * Runtime: nodejs (NOT edge — Vercel edge has 4MB body limit)
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, SONNET } from "@/lib/ai-sdk";
import { FOOD_SCAN_PROMPT } from "@/lib/ai-prompts/vision";
import {
  FoodScanResultSchema,
  type FoodScanResult,
} from "@/lib/food-scanner/types";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

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
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

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

    const { object } = await generateObject({
      model: provider(SONNET),
      schema: FoodScanResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: `data:${mediaType};base64,${base64Data}`,
            },
            {
              type: "text",
              text: "Identify each food item and estimate its nutritional content.",
            },
          ],
        },
      ],
      maxOutputTokens: 2048,
    });

    return NextResponse.json(object);
  } catch (error) {
    logger.error("Food scan API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food" },
      { status: 500 },
    );
  }
}
