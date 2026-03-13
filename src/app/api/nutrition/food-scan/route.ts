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
import { FoodScanResultSchema } from "@/lib/food-scanner/types";
import type { EnrichedFoodEstimation } from "@/lib/food-scanner/types";
import { searchFood, scaleToGrams } from "@/lib/usda";

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
    const { response: authErr } = await requireAuth(supabase);
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
              image: Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)),
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

    // Enrich with USDA data (all lookups in parallel)
    const enrichedItems: EnrichedFoodEstimation[] = await Promise.all(
      object.items.map(async (item) => {
        if (!process.env.USDA_API_KEY) {
          return { ...item, usda_match: null, source: "ai-scan" as const };
        }

        const match = await searchFood(item.food_name);
        if (!match || item.estimated_weight_g <= 0) {
          return { ...item, usda_match: null, source: "ai-scan" as const };
        }

        const scaled = scaleToGrams(match, item.estimated_weight_g);

        return {
          ...item,
          estimated_calories: scaled.calories,
          estimated_protein_g: scaled.protein_g,
          estimated_carbs_g: scaled.carbs_g,
          estimated_fat_g: scaled.fat_g,
          usda_match: {
            fdc_id: match.fdc_id,
            description: match.description,
            data_source: match.data_source,
          },
          source: "usda" as const,
        };
      }),
    );

    return NextResponse.json({
      items: enrichedItems,
      overall_notes: object.overall_notes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze food";
    logger.error("Food scan API error:", message, error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
