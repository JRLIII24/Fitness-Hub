/**
 * Food Vision API
 * POST /api/nutrition/vision
 *
 * Accepts a base64 food photo and uses AI to estimate
 * nutritional content of each visible food item.
 *
 * Rate limited to 20 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import { FOOD_VISION_ENABLED } from "@/lib/features";
import type { FoodEstimation } from "@/lib/vision/types";

const DAILY_LIMIT = 20;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

const SYSTEM_PROMPT = `You are a nutrition analysis AI. Analyze the food photo and identify each distinct food item.
For each item, estimate:
- name: specific food name
- estimated_grams: portion size in grams
- calories: estimated calories
- protein_g: protein in grams
- carbs_g: carbohydrates in grams
- fat_g: fat in grams
- confidence: "high" if clearly identifiable, "medium" if partially visible, "low" if uncertain

Also provide:
- meal_description: brief description of the entire meal
- total_calories, total_protein_g, total_carbs_g, total_fat_g: sums

Respond ONLY with valid JSON matching this schema:
{
  "items": [{"name":"string","estimated_grams":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"confidence":"high"}],
  "total_calories": 0,
  "total_protein_g": 0,
  "total_carbs_g": 0,
  "total_fat_g": 0,
  "meal_description": "string"
}`;

function isValidDataUrl(image: string): boolean {
  return (
    image.startsWith("data:image/jpeg") ||
    image.startsWith("data:image/png") ||
    image.startsWith("data:image/webp")
  );
}

function isValidBase64(image: string): boolean {
  // Raw base64 without data URL prefix
  return /^[A-Za-z0-9+/]+=*$/.test(image.slice(0, 100));
}

function getImageDataUrl(image: string): string {
  if (isValidDataUrl(image)) return image;
  if (isValidBase64(image)) return `data:image/jpeg;base64,${image}`;
  throw new Error("Invalid image format");
}

function validateEstimation(data: unknown): data is FoodEstimation {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.items) &&
    typeof d.total_calories === "number" &&
    typeof d.total_protein_g === "number" &&
    typeof d.total_carbs_g === "number" &&
    typeof d.total_fat_g === "number" &&
    typeof d.meal_description === "string"
  );
}

export async function POST(request: Request) {
  try {
    if (!FOOD_VISION_ENABLED) {
      return NextResponse.json({ error: "Food vision is not enabled" }, { status: 403 });
    }

    const ai = getAIClient();
    if (!ai) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:food-vision:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const image: string | undefined = body?.image;

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }

    // Check size (base64 is ~33% larger than binary, so 4MB binary ≈ 5.3MB base64)
    const base64Part = image.includes(",") ? image.split(",")[1] : image;
    const estimatedBytes = (base64Part.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Image exceeds 4MB limit" }, { status: 400 });
    }

    let imageDataUrl: string;
    try {
      imageDataUrl = getImageDataUrl(image);
    } catch {
      return NextResponse.json({ error: "Invalid image format. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: "Analyze this meal photo and estimate the nutritional content of each food item." },
          ],
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "null");

    if (!validateEstimation(raw)) {
      logger.error("Food vision: invalid AI response shape", raw);
      return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
    }

    return NextResponse.json(raw as FoodEstimation);
  } catch (error) {
    logger.error("Food vision error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
