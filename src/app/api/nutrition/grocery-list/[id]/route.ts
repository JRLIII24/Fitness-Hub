/**
 * Grocery List CRUD by ID
 * GET /api/nutrition/grocery-list/[id]  — Fetch a grocery list
 * PATCH /api/nutrition/grocery-list/[id] — Update items (check/uncheck, add, remove)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { GroceryPatchSchema } from "@/lib/grocery/types";

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid grocery list ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // RLS enforces user_id match
    const { data, error } = await supabase
      .from("grocery_lists")
      .select(
        "id, title, week_start, items, ai_summary, created_at, updated_at",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Grocery list not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      categories: data.items,
      summary: data.ai_summary,
      week_start: data.week_start,
      generated_at: data.updated_at,
    });
  } catch (error) {
    logger.error("Grocery GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch grocery list" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid grocery list ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const parsed = GroceryPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid items format", details: parsed.error.issues },
        { status: 400 },
      );
    }

    // RLS enforces user_id match
    const { data, error } = await supabase
      .from("grocery_lists")
      .update({
        items: parsed.data.items,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, title, week_start, items, ai_summary, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Grocery list not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      categories: data.items,
      summary: data.ai_summary,
      week_start: data.week_start,
      generated_at: data.updated_at,
    });
  } catch (error) {
    logger.error("Grocery PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update grocery list" },
      { status: 500 },
    );
  }
}
