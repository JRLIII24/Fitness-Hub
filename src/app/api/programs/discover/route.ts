/**
 * GET /api/programs/discover
 *
 * Community marketplace discovery endpoint for training programs.
 *
 * Query params:
 *   q        - fuzzy match on name / description (ilike)
 *   goal     - strength | hypertrophy | general | weight_loss
 *   weeks    - filter by exact week count (e.g. "4", "8")
 *   sort     - newest | popular   (default: popular)
 *   page     - 1-based page number (default: 1)
 *   limit    - records per page, max 50 (default: 12)
 *
 * Response:
 *   { programs: PublicProgram[], total: number, page: number, limit: number }
 *
 * Requires migration 079: is_public column, profiles FK, and public read RLS policy.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const VALID_SORTS = new Set(["newest", "popular"]);
const VALID_GOALS = new Set(["strength", "hypertrophy", "general", "weight_loss"]);
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──────────────────────────────────────────────────────────────
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // ── Rate limit: 30 req/min ───────────────────────────────────────────
    const rlAllowed = await rateLimit(`programs-discover:${user.id}`, 30, 60_000);
    if (!rlAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // ── Parse query params ───────────────────────────────────────────────
    const sp = request.nextUrl.searchParams;
    const search = sp.get("q")?.trim() ?? "";
    const goalParam = sp.get("goal")?.trim().toLowerCase() ?? "";
    const weeksParam = sp.get("weeks")?.trim() ?? "";
    const sortParam = sp.get("sort") ?? "popular";
    const sort = VALID_SORTS.has(sortParam) ? sortParam : "popular";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get("limit") ?? "12", 10)));
    const offset = (page - 1) * limit;

    // ── Build query ──────────────────────────────────────────────────────
    let query = supabase
      .from("training_programs")
      .select(
        `
        id, user_id, name, description, goal, weeks, days_per_week,
        status, program_data, created_at,
        creator:profiles!training_programs_user_id_profiles_fkey ( display_name, avatar_url )
        `,
        { count: "exact" },
      )
      .eq("is_public", true);

    // ── Goal filter ──────────────────────────────────────────────────────
    if (goalParam && VALID_GOALS.has(goalParam)) {
      query = query.eq("goal", goalParam);
    }

    // ── Weeks filter ─────────────────────────────────────────────────────
    const weeksNum = parseInt(weeksParam, 10);
    if (weeksNum && weeksNum >= 4 && weeksNum <= 12) {
      query = query.eq("weeks", weeksNum);
    }

    // ── Fuzzy search ─────────────────────────────────────────────────────
    if (search.length > 0) {
      const safe = search
        .replace(/[%_\\]/g, "\\$&")
        .replace(/,/g, " ")
        .trim();
      if (safe.length > 0) {
        const term = `%${safe}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term}`);
      }
    }

    // ── Sorting ──────────────────────────────────────────────────────────
    if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // "popular" — no save_count on programs yet, so sort by created_at as proxy
      query = query.order("created_at", { ascending: false });
    }

    // ── Pagination ───────────────────────────────────────────────────────
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // Graceful degradation if is_public column doesn't exist yet
      if (error.code === "42703" || error.code === "42P01") {
        console.warn("[/api/programs/discover] schema not yet migrated:", error.message);
        return NextResponse.json({ programs: [], total: 0, page, limit });
      }
      logger.error("[/api/programs/discover] query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch programs", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { programs: data ?? [], total: count ?? 0, page, limit },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    logger.error("[/api/programs/discover] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
