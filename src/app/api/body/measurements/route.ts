/**
 * Body Measurements API
 * GET    /api/body/measurements         – last N entries (default 365)
 * POST   /api/body/measurements         – create/update entry for a given date
 * PUT    /api/body/measurements         – update an entry by id
 * DELETE /api/body/measurements?id=     – remove entry by id
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse-payload";
import {
  bodyMeasurementCreateSchema,
  bodyMeasurementUpdateSchema,
} from "@/lib/validation/api.schemas";

const COLUMNS =
  "id, measured_date, waist_cm, chest_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, note";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") ?? "365"),
      365,
    );

    const { data, error } = await supabase
      .from("body_measurements")
      .select(COLUMNS)
      .eq("user_id", user.id)
      .order("measured_date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    logger.error("GET /api/body/measurements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch measurements" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = parsePayload(bodyMeasurementCreateSchema, await req.json());

    const { data, error } = await supabase
      .from("body_measurements")
      .upsert(
        {
          user_id: user.id,
          measured_date: body.measured_date,
          waist_cm: body.waist_cm ?? null,
          chest_cm: body.chest_cm ?? null,
          hips_cm: body.hips_cm ?? null,
          left_arm_cm: body.left_arm_cm ?? null,
          right_arm_cm: body.right_arm_cm ?? null,
          left_thigh_cm: body.left_thigh_cm ?? null,
          right_thigh_cm: body.right_thigh_cm ?? null,
          note: body.note?.trim() ? body.note.trim() : null,
        },
        { onConflict: "user_id,measured_date" },
      )
      .select(COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    logger.error("POST /api/body/measurements error:", error);
    return NextResponse.json(
      { error: "Failed to save measurement" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = parsePayload(bodyMeasurementUpdateSchema, await req.json());

    const { data, error } = await supabase
      .from("body_measurements")
      .update({
        measured_date: body.measured_date,
        waist_cm: body.waist_cm ?? null,
        chest_cm: body.chest_cm ?? null,
        hips_cm: body.hips_cm ?? null,
        left_arm_cm: body.left_arm_cm ?? null,
        right_arm_cm: body.right_arm_cm ?? null,
        left_thigh_cm: body.left_thigh_cm ?? null,
        right_thigh_cm: body.right_thigh_cm ?? null,
        note: body.note?.trim() ? body.note.trim() : null,
      })
      .eq("user_id", user.id)
      .eq("id", body.id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        return NextResponse.json(
          { error: "An entry for that date already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    logger.error("PUT /api/body/measurements error:", error);
    return NextResponse.json(
      { error: "Failed to update measurement" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query param required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("body_measurements")
      .delete()
      .eq("user_id", user.id)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("DELETE /api/body/measurements error:", error);
    return NextResponse.json(
      { error: "Failed to delete measurement" },
      { status: 500 },
    );
  }
}
