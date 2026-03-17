/**
 * One-time backfill: populate fiber_g, sugar_g, sodium_mg on food_items
 * that were logged before these fields were tracked.
 *
 * POST /api/nutrition/backfill-micros
 *
 * Auth-gated to the current user's food_items only.
 * Safe to run multiple times — skips items that already have data.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { searchFood, scaleToGrams } from "@/lib/usda";

export async function POST() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr || !user) return authErr!;

    if (!process.env.USDA_API_KEY) {
      return NextResponse.json(
        { error: "USDA API key not configured" },
        { status: 503 },
      );
    }

    // Find food_items created by this user where fiber/sugar/sodium are all NULL
    const { data: items, error: fetchErr } = await supabase
      .from("food_items")
      .select("id, name, serving_size_g")
      .eq("created_by", user.id)
      .is("fiber_g", null)
      .is("sugar_g", null)
      .is("sodium_mg", null)
      .limit(100);

    if (fetchErr) {
      logger.error("Backfill fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ updated: 0, message: "Nothing to backfill" });
    }

    let updated = 0;
    const errors: string[] = [];

    // Process sequentially to avoid USDA rate limits
    for (const item of items) {
      try {
        const match = await searchFood(item.name);
        if (!match) {
          errors.push(`No USDA match for "${item.name}"`);
          continue;
        }

        const grams = item.serving_size_g ?? 100;
        const scaled = scaleToGrams(match, grams);

        const { error: updateErr } = await supabase
          .from("food_items")
          .update({
            fiber_g: scaled.fiber_g,
            sugar_g: scaled.sugar_g,
            sodium_mg: scaled.sodium_mg,
          })
          .eq("id", item.id);

        if (updateErr) {
          errors.push(`Update failed for "${item.name}": ${updateErr.message}`);
        } else {
          updated++;
        }
      } catch (err) {
        errors.push(
          `Error processing "${item.name}": ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }

    return NextResponse.json({
      total: items.length,
      updated,
      skipped: items.length - updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backfill failed";
    logger.error("Backfill micros error:", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
