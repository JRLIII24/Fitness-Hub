/**
 * GET /api/templates/discover
 *
 * Community marketplace discovery endpoint.
 *
 * Query params:
 *   search        – fuzzy match on name / description (ilike)
 *   muscle_groups – comma-separated list (e.g. "chest,back")
 *   sort          – save_count | trending | newest  (default: save_count)
 *   page          – 1-based page number            (default: 1)
 *   page_size     – records per page, max 50        (default: 20)
 *
 * Response:
 *   { templates: PublicTemplate[], total: number, page: number, page_size: number }
 *
 * Indexing strategy:
 *   • idx_workout_templates_marketplace (save_count DESC) WHERE is_public = true
 *     → powers save_count and trending sorts with a partial index scan
 *   • ilike search runs on name/description TEXT columns; at scale add a
 *     pg_trgm GIN index:
 *       CREATE INDEX idx_templates_name_trgm ON workout_templates
 *         USING GIN (name gin_trgm_ops) WHERE is_public = true;
 *   • Muscle-group filtering joins through template_exercises → exercises;
 *     idx_template_exercises_template_id covers the join efficiently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_SORTS = new Set(['save_count', 'trending', 'newest']);
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ────────────────────────────────────────────────────────────────
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        is_public, save_count, primary_muscle_group, created_at, updated_at,
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

    // ── DB-level muscle-group filter ─────────────────────────────────────────
    if (muscleGroups.length > 0) {
      query = query.in('primary_muscle_group', muscleGroups);
    }

    // ── Fuzzy search ────────────────────────────────────────────────────────
    if (search.length > 0) {
      const term = `%${search}%`;
      query = query.or(`name.ilike.${term},description.ilike.${term}`);
    }

    // ── Sorting ─────────────────────────────────────────────────────────────
    // trending = save_count (primary) + recency (secondary). A proper decay
    // function belongs in a DB view; this approximation is acceptable for MVP.
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      // save_count and trending both lead with save_count
      query = query
        .order('save_count', { ascending: false })
        .order('updated_at', { ascending: false });
    }

    // ── Pagination ──────────────────────────────────────────────────────────
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

    const result = templates.map((t: { id: string }) => ({
      ...t,
      is_saved: savedIds.has(t.id),
    }));

    return NextResponse.json({
      templates: result,
      total: count ?? 0,
      page,
      page_size,
    });
  } catch (err) {
    console.error('[/api/templates/discover] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
