/**
 * Meal Plan API
 * GET  /api/nutrition/meal-plan?week=YYYY-MM-DD  – get plan for a week (defaults to current ISO week Monday)
 * POST /api/nutrition/meal-plan                  – create or upsert a plan
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse";
import { mealPlanCreateSchema } from "@/lib/validation/api.schemas";
import { startOfISOWeek, format } from "date-fns";

function currentWeekStart(): string {
  return format(startOfISOWeek(new Date()), "yyyy-MM-dd");
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const week = req.nextUrl.searchParams.get("week") ?? currentWeekStart();

    const { data: plan, error: planErr } = await (supabase as any)
      .from("meal_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", week)
      .single();

    if (planErr && planErr.code !== "PGRST116") throw planErr; // PGRST116 = no rows

    if (!plan) {
      return NextResponse.json({ plan: null });
    }

    const { data: days, error: daysErr } = await (supabase as any)
      .from("meal_plan_days")
      .select("*")
      .eq("plan_id", plan.id)
      .order("day_of_week", { ascending: true })
      .order("meal_type", { ascending: true })
      .order("sort_order", { ascending: true });

    if (daysErr) throw daysErr;

    return NextResponse.json({ plan: { ...plan, days: days ?? [] } });
  } catch (error) {
    logger.error("GET /api/nutrition/meal-plan error:", error);
    return NextResponse.json({ error: "Failed to fetch meal plan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const parsed = parsePayload(mealPlanCreateSchema, await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
    }
    const { name, week_start, notes } = parsed.data;

    const { data, error } = await (supabase as any)
      .from("meal_plans")
      .upsert(
        { user_id: user.id, name: name.trim(), week_start, notes: notes ?? null },
        { onConflict: "user_id,week_start" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ plan: { ...data, days: [] } });
  } catch (error) {
    logger.error("POST /api/nutrition/meal-plan error:", error);
    return NextResponse.json({ error: "Failed to create meal plan" }, { status: 500 });
  }
}
