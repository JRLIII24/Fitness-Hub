/**
 * Single Exercise API Route
 * GET  – fetch a single exercise by ID
 * PATCH – update name/equipment on a custom exercise owned by the current user
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Create Supabase client
    const supabase = await createClient();

    // Fetch exercise by ID
    const { data: exercise, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return NextResponse.json(
          { error: "Exercise not found" },
          { status: 404 }
        );
      }

      logger.error("Exercise fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch exercise" },
        { status: 500 }
      );
    }

    return NextResponse.json({ exercise });
  } catch (error) {
    logger.error("Exercise fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const VALID_EQUIPMENT = new Set([
  "barbell", "dumbbell", "kettlebell", "machine", "cable",
  "bodyweight", "band", "smith_machine",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (trimmed.length < 2 || trimmed.length > 200) {
        return NextResponse.json({ error: "Name must be 2-200 characters" }, { status: 400 });
      }
      updates.name = trimmed;
    }

    if (typeof body.equipment === "string") {
      if (!VALID_EQUIPMENT.has(body.equipment)) {
        return NextResponse.json({ error: "Invalid equipment type" }, { status: 400 });
      }
      updates.equipment = body.equipment;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // RLS ensures only the creator can update their own custom exercises
    const { data, error } = await supabase
      .from("exercises")
      .update(updates as any)
      .eq("id", id)
      .eq("is_custom", true)
      .eq("created_by", user.id)
      .select("id, name, slug, muscle_group, equipment, category, instructions, form_tips, image_url")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Exercise not found or not editable" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error("PATCH /api/exercises/[id] error:", error);
    return NextResponse.json({ error: "Failed to update exercise" }, { status: 500 });
  }
}
