/**
 * GET /api/templates/discover
 *
 * Community marketplace discovery endpoint.
 *
 * Query params:
 *   search        – fuzzy match on name / description (ilike)
 *   muscle_groups – comma-separated list (e.g. "chest,back")
 *   sort          – save_count | trending | newest | rating  (default: save_count)
 *   page          – 1-based page number            (default: 1)
 *   page_size     – records per page, max 50        (default: 20)
 *
 * Response:
 *   { templates: PublicTemplate[], total: number, page: number, page_size: number }
 *
 * Indexing strategy:
 *   • idx_workout_templates_marketplace (save_count DESC) WHERE is_public = true
 *     → powers save_count and trending sorts with a partial index scan
 *   • idx_templates_rating (avg_rating DESC NULLS LAST, review_count DESC) WHERE is_public = true
 *     → powers DB-level rating sort (migration 050)
 *   • idx_templates_name_trgm / idx_templates_description_trgm (GIN pg_trgm)
 *     → powers fast ILIKE fuzzy search (migration 051)
 *   • Muscle-group filtering joins through template_exercises → exercises;
 *     idx_template_exercises_template_id covers the join efficiently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";

const VALID_SORTS = new Set(['save_count', 'trending', 'newest', 'rating']);
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ────────────────────────────────────────────────────────────────
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // ── Rate limit: 30 requests per minute per user ──────────────────────────
    const rlAllowed = await rateLimit(`discover:${user.id}`, 30, 60_000);
    if (!rlAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // ── Parse & validate query params ───────────────────────────────────────
    const sp = request.nextUrl.searchParams;
    const search = sp.get('search')?.trim() ?? '';
    const rawGroups = sp.get('muscle_groups') ?? '';
    const sortParam = sp.get('sort') ?? 'save_count';
    const sort = VALID_SORTS.has(sortParam) ? sortParam : 'save_count';
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('page_size') ?? '20', 10)));
    const offset = (page - 1) * page_size;

    const tab = sp.get('tab') ?? 'community'; // 'community' | 'mine'

    const muscleGroups = rawGroups
      .split(',')
      .map(g => g.trim().toLowerCase())
      .filter(Boolean);

    // ── Build base query ────────────────────────────────────────────────────
    let query = supabase
      .from('workout_templates')
      .select(
        `
        id, user_id, name, description, color, estimated_duration_min,
        is_public, save_count, primary_muscle_group, difficulty_level, created_at, updated_at,
        avg_rating, review_count,
        creator:profiles!workout_templates_user_id_fkey ( display_name, avatar_url ),
        template_exercises (
          id, exercise_id, sort_order, target_sets, target_reps,
          target_weight_kg, rest_seconds, notes,
          exercises ( id, name, muscle_group, equipment, category )
        )
        `,
        { count: 'exact' },
      )
      .eq('is_public', true);

    // My Templates tab: filter to the caller's own public templates.
    // Community tab: exclude the caller's own templates from the browse feed.
    if (tab === 'mine') {
      query = query.eq('user_id', user.id);
    } else {
      query = query.neq('user_id', user.id);
    }

    // ── DB-level muscle-group filter ─────────────────────────────────────────
    if (muscleGroups.length > 0) {
      query = query.in('primary_muscle_group', muscleGroups);
    }

    // ── Fuzzy search ────────────────────────────────────────────────────────
    if (search.length > 0) {
      // Escape ILIKE metacharacters so user input is treated as literal text.
      // Commas are replaced with spaces because PostgREST uses them as .or()
      // condition separators and there is no quoting mechanism for values.
      const safe = search
        .replace(/[%_\\]/g, '\\$&') // escape %, _, \ → literal chars in ILIKE
        .replace(/,/g, ' ')          // commas → space (prevents PostgREST breakage)
        .trim();
      if (safe.length > 0) {
        const term = `%${safe}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term}`);
      }
    }

    // ── Sorting ─────────────────────────────────────────────────────────────
    // All sorts are now handled at the DB level.
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'rating') {
      // avg_rating and review_count are denormalized columns on workout_templates
      // (migration 050), so PostgREST can sort by them using idx_templates_rating.
      query = query
        .order('avg_rating', { ascending: false, nullsFirst: false })
        .order('review_count', { ascending: false });
    } else {
      // save_count and trending both lead with save_count
      query = query
        .order('save_count', { ascending: false })
        .order('updated_at', { ascending: false });
    }

    // ── Pagination — applied unconditionally for all sorts ───────────────────
    query = query.range(offset, offset + page_size - 1);

    const { data, error, count } = await query;
    if (error) {
      // 42703 = undefined_column (is_public / save_count not yet migrated)
      // 42P01 = undefined_table  (template_saves not yet created)
      // Return an empty result set so the UI degrades gracefully rather than
      // throwing a 500 while the database migration is being applied.
      if (error.code === '42703' || error.code === '42P01') {
        console.warn('[/api/templates/discover] schema not yet migrated:', error.message);
        return NextResponse.json({ templates: [], total: 0, page, page_size });
      }
      console.error('[/api/templates/discover] query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: error.message },
        { status: 500 },
      );
    }

    const templates = data ?? [];

    // ── Decorate with is_saved for the calling user ─────────────────────────
    const templateIds = templates.map((t: { id: string }) => t.id);
    let savedIds: Set<string> = new Set();

    if (templateIds.length > 0) {
      const { data: saves, error: savesErr } = await supabase
        .from('template_saves')
        .select('template_id')
        .eq('user_id', user.id)
        .in('template_id', templateIds);

      if (!savesErr) {
        savedIds = new Set((saves ?? []).map((s: { template_id: string }) => s.template_id));
      }
    }

    // avg_rating and review_count are now direct columns on workout_templates rows;
    // no separate rating stats query or in-memory sort needed.
    const result = templates.map((t: { id: string; is_saved?: boolean }) => ({
      ...t,
      is_saved: savedIds.has(t.id),
    }));

    return NextResponse.json(
      { templates: result, total: count ?? 0, page, page_size },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error('[/api/templates/discover] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
