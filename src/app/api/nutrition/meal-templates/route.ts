/**
 * Meal Templates API
 * GET  /api/nutrition/meal-templates – list user's templates
 * POST /api/nutrition/meal-templates – create a new meal template
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse-payload";
import { mealTemplateCreateSchema } from "@/lib/validation/api.schemas";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data, error } = await supabase
      .from("meal_templates")
      .select("id, name, items, total_calories, total_protein_g, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    logger.error("GET /api/nutrition/meal-templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meal templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { name, items } = parsePayload(mealTemplateCreateSchema, await req.json());

    const total_calories = items.reduce((sum, i) => sum + i.calories * i.servings, 0);
    const total_protein_g = items.reduce(
      (sum, i) => sum + (i.protein_g ?? 0) * i.servings,
      0,
    );

    const { data, error } = await supabase
      .from("meal_templates")
      .insert({
        user_id: user.id,
        name: name.trim(),
        items,
        total_calories,
        total_protein_g,
      })
      .select("id, name, items, total_calories, total_protein_g, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    logger.error("POST /api/nutrition/meal-templates error:", error);
    return NextResponse.json(
      { error: "Failed to create meal template" },
      { status: 500 },
    );
  }
}
