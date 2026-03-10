/**
 * Program Detail API
 * GET  /api/programs/:id — get program detail with full program_data
 * PATCH /api/programs/:id — update status, current_week, current_day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data: program, error } = await supabase
      .from("training_programs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json({ program });
  } catch {
    return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status && ["draft", "active", "completed", "abandoned"].includes(body.status)) {
      updates.status = body.status;
      if (body.status === "active" && !body.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (body.status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (typeof body.current_week === "number") updates.current_week = body.current_week;
    if (typeof body.current_day === "number") updates.current_day = body.current_day;
    if (typeof body.is_public === "boolean") updates.is_public = body.is_public;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: program, error } = await supabase
      .from("training_programs")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status, current_week, current_day, started_at, completed_at")
      .single();

    if (error || !program) {
      return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
    }

    return NextResponse.json({ program });
  } catch {
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
  }
}
