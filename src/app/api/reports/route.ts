/**
 * Reports API
 * GET /api/reports?limit=10&offset=0
 *
 * Paginated list of user's weekly reports.
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
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const { data: reports, error } = await (supabase as any)
      .from("weekly_reports")
      .select("id, week_start, report_json, generated_at")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: reports ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 },
    );
  }
}
