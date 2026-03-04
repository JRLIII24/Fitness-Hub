/**
 * Exercises API
 * POST /api/exercises – create a custom exercise for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse-payload";
import { exerciseCreateSchema } from "@/lib/validation/api.schemas";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { name, muscle_group, equipment, category, instructions } = parsePayload(
      exerciseCreateSchema,
      await req.json(),
    );

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
    if (error instanceof NextResponse) return error;
    logger.error("POST /api/exercises error:", error);
    return NextResponse.json({ error: "Failed to create exercise" }, { status: 500 });
  }
}
