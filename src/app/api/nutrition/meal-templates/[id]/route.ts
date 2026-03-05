/**
 * Meal Template by ID API
 * PUT    /api/nutrition/meal-templates/[id] – update name and/or items
 * DELETE /api/nutrition/meal-templates/[id] – delete template
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse";
import { mealTemplateCreateSchema } from "@/lib/validation/api.schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { id } = await context.params;
    const parsed = parsePayload(mealTemplateCreateSchema, await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
    }
    const { name, items } = parsed.data;

    const total_calories = items.reduce((sum, i) => sum + i.calories * i.servings, 0);
    const total_protein_g = items.reduce(
      (sum, i) => sum + (i.protein_g ?? 0) * i.servings,
      0,
    );

    const { data, error } = await supabase
      .from("meal_templates")
      .update({
        name: name.trim(),
        items,
        total_calories,
        total_protein_g,
      })
      .eq("user_id", user.id)
      .eq("id", id)
      .select("id, name, items, total_calories, total_protein_g, created_at, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error("PUT /api/nutrition/meal-templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update meal template" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { id } = await context.params;

    const { error } = await supabase
      .from("meal_templates")
      .delete()
      .eq("user_id", user.id)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("DELETE /api/nutrition/meal-templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete meal template" },
      { status: 500 },
    );
  }
}
