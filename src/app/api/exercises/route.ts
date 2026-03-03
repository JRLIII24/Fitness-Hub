/**
 * Exercises API
 * POST /api/exercises – create a custom exercise for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_CATEGORIES } from "@/lib/constants";

const VALID_MUSCLE_GROUPS = MUSCLE_GROUPS as readonly string[];
const VALID_EQUIPMENT = EQUIPMENT_TYPES as readonly string[];
const VALID_CATEGORIES = EXERCISE_CATEGORIES as readonly string[];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await req.json();
    const { name, muscle_group, equipment, category, instructions } = body as {
      name: string;
      muscle_group: string;
      equipment: string;
      category: string;
      instructions?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!VALID_MUSCLE_GROUPS.includes(muscle_group)) {
      return NextResponse.json({ error: "invalid muscle_group" }, { status: 400 });
    }
    if (!VALID_EQUIPMENT.includes(equipment)) {
      return NextResponse.json({ error: "invalid equipment" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "invalid category" }, { status: 400 });
    }

    // Generate a unique slug
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

    const { data, error } = await supabase
      .from("exercises")
      .insert({
        name: name.trim(),
        slug: `${slug}-${Date.now()}`,
        muscle_group,
        equipment,
        category,
        instructions: instructions?.trim() || null,
        is_custom: true,
        created_by: user.id,
      })
      .select("id, name, muscle_group, equipment, category, instructions")
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.error("POST /api/exercises error:", error);
    return NextResponse.json({ error: "Failed to create exercise" }, { status: 500 });
  }
}
