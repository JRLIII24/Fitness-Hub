/**
 * Body Weight Logs API
 * GET  /api/body/weight         – last N entries (default 90)
 * POST /api/body/weight         – create/update entry for a given date
 * PUT  /api/body/weight         – update an entry by id
 * DELETE /api/body/weight?id=   – remove entry by id (or ?date= fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "90"), 365);

    const { data, error } = await supabase
      .from("body_weight_logs")
      .select("id, logged_date, weight_kg, body_fat_pct, note")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    logger.error("GET /api/body/weight error:", error);
    return NextResponse.json({ error: "Failed to fetch weight logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await req.json();
    const { logged_date, weight_kg, body_fat_pct, note } = body as {
      logged_date: string;
      weight_kg: number;
      body_fat_pct?: number | null;
      note?: string | null;
    };

    if (!logged_date || typeof weight_kg !== "number" || Number.isNaN(weight_kg) || weight_kg <= 0) {
      return NextResponse.json({ error: "logged_date and positive weight_kg are required" }, { status: 400 });
    }

    if (
      body_fat_pct != null &&
      (typeof body_fat_pct !== "number" ||
        Number.isNaN(body_fat_pct) ||
        body_fat_pct < 0 ||
        body_fat_pct > 100)
    ) {
      return NextResponse.json({ error: "body_fat_pct must be between 0 and 100" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("body_weight_logs")
      .upsert(
        {
          user_id: user.id,
          logged_date,
          weight_kg,
          body_fat_pct: body_fat_pct ?? null,
          note: note?.trim() ? note.trim() : null,
        },
        { onConflict: "user_id,logged_date" }
      )
      .select("id, logged_date, weight_kg, body_fat_pct, note")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    logger.error("POST /api/body/weight error:", error);
    return NextResponse.json({ error: "Failed to save weight log" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await req.json();
    const { id, logged_date, weight_kg, body_fat_pct, note } = body as {
      id: string;
      logged_date: string;
      weight_kg: number;
      body_fat_pct?: number | null;
      note?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!logged_date || typeof weight_kg !== "number" || Number.isNaN(weight_kg) || weight_kg <= 0) {
      return NextResponse.json({ error: "logged_date and positive weight_kg are required" }, { status: 400 });
    }

    if (
      body_fat_pct != null &&
      (typeof body_fat_pct !== "number" ||
        Number.isNaN(body_fat_pct) ||
        body_fat_pct < 0 ||
        body_fat_pct > 100)
    ) {
      return NextResponse.json({ error: "body_fat_pct must be between 0 and 100" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("body_weight_logs")
      .update({
        logged_date,
        weight_kg,
        body_fat_pct: body_fat_pct ?? null,
        note: note?.trim() ? note.trim() : null,
      })
      .eq("user_id", user.id)
      .eq("id", id)
      .select("id, logged_date, weight_kg, body_fat_pct, note")
      .maybeSingle();

    if (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        return NextResponse.json({ error: "An entry for that date already exists" }, { status: 409 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error("PUT /api/body/weight error:", error);
    return NextResponse.json({ error: "Failed to update weight log" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const id = req.nextUrl.searchParams.get("id");
    const date = req.nextUrl.searchParams.get("date");

    if (!id && !date) {
      return NextResponse.json({ error: "id or date query param required" }, { status: 400 });
    }

    let query = supabase
      .from("body_weight_logs")
      .delete()
      .eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("logged_date", date);
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("DELETE /api/body/weight error:", error);
    return NextResponse.json({ error: "Failed to delete weight log" }, { status: 500 });
  }
}
