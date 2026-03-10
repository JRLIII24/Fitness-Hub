/**
 * Programs API
 * GET /api/programs — list user's programs (paginated)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const offset = (page - 1) * limit;

    const { data: programs, error, count } = await supabase
      .from("training_programs")
      .select("id, name, description, goal, weeks, days_per_week, status, current_week, current_day, started_at, completed_at, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 });
    }

    return NextResponse.json({
      programs: programs || [],
      total: count || 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 });
  }
}
