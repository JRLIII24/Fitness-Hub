/**
 * Pod Challenges & Template Marketplace – Server-side Service Layer
 *
 * Responsibilities:
 *  - CRUD for pod_challenges
 *  - Leaderboard aggregation via RPC
 *  - Template marketplace: browse, save, unsave
 */

import { createClient } from '@/lib/supabase/server';
import type {
  PodChallenge,
  CreateChallengeInput,
  ChallengeLeaderboard,
  LeaderboardEntry,
  PublicTemplate,
} from '@/types/pods';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreUnit(type: PodChallenge['challenge_type']): 'kg' | 'sessions' {
  if (type === 'volume') return 'kg';
  return 'sessions';
}

function isChallengeActive(challenge: PodChallenge): boolean {
  const today = new Date().toISOString().split('T')[0];
  return challenge.start_date <= today && today <= challenge.end_date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pod Challenges
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new challenge within a pod.
 * The calling user must be an active pod member (enforced by RLS).
 */
export async function createPodChallenge(
  podId: string,
  input: CreateChallengeInput,
): Promise<PodChallenge> {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pod_challenges')
    .insert({
      pod_id:         podId,
      name:           input.name,
      challenge_type: input.challenge_type,
      start_date:     input.start_date,
      end_date:       input.end_date,
      target_value:   input.target_value ?? null,
      created_by:     user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create challenge: ${error.message}`);
  return data as PodChallenge;
}

/**
 * List all challenges for a pod, newest first.
 * Optionally filter to active challenges only.
 */
export async function getPodChallenges(
  podId: string,
  options: { activeOnly?: boolean } = {},
): Promise<PodChallenge[]> {
  const supabase = await createClient();

  let query = supabase
    .from('pod_challenges')
    .select('*')
    .eq('pod_id', podId)
    .order('created_at', { ascending: false });

  if (options.activeOnly) {
    const today = new Date().toISOString().split('T')[0];
    query = query.lte('start_date', today).gte('end_date', today);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch challenges: ${error.message}`);
  return (data ?? []) as PodChallenge[];
}

/**
 * Fetch leaderboard for a challenge via the PostgreSQL RPC.
 * Returns entries ranked by score descending.
 */
export async function getPodChallengeLeaderboard(
  challengeId: string,
): Promise<ChallengeLeaderboard> {
  const supabase = await createClient();

  // Fetch challenge metadata (needed for score_unit / is_active)
  const { data: challenge, error: cErr } = await supabase
    .from('pod_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (cErr || !challenge) throw new Error('Challenge not found');

  // Call the aggregation RPC
  const { data: rows, error: rpcErr } = await supabase
    .rpc('get_pod_challenge_leaderboard', { p_challenge_id: challengeId });

  if (rpcErr) throw new Error(`Leaderboard RPC failed: ${rpcErr.message}`);

  const entries: LeaderboardEntry[] = (rows ?? []).map((row: LeaderboardEntry) => ({
    user_id:      row.user_id,
    display_name: row.display_name,
    avatar_url:   row.avatar_url,
    score:        Number(row.score),
    rank:         Number(row.rank),
    workouts_cnt: row.workouts_cnt,
  }));

  return {
    challenge:  challenge as PodChallenge,
    entries,
    score_unit: scoreUnit(challenge.challenge_type),
    is_active:  isChallengeActive(challenge as PodChallenge),
  };
}

/**
 * Delete a challenge. Only the creator can delete (enforced by RLS).
 */
export async function deletePodChallenge(challengeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('pod_challenges')
    .delete()
    .eq('id', challengeId);
  if (error) throw new Error(`Failed to delete challenge: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Marketplace
// ─────────────────────────────────────────────────────────────────────────────

export type MarketplaceSortKey = 'save_count' | 'trending' | 'newest';

export interface MarketplaceFilters {
  search?:       string;
  muscle_groups?: string[];
  sort?:         MarketplaceSortKey;
  page?:         number;
  page_size?:    number;
}

/**
 * Browse public templates from the community marketplace.
 *
 * Sorting strategies:
 *   save_count – highest saves first
 *   trending   – weighted score: (saves × 2) + recency decay via updated_at
 *   newest     – most recently published first
 *
 * Muscle group filtering joins through template_exercises → exercises.
 * Fuzzy search is performed via ilike on name and description.
 */
export async function getPublicTemplates(
  filters: MarketplaceFilters = {},
): Promise<{ templates: PublicTemplate[]; total: number }> {
  const {
    search,
    muscle_groups,
    sort        = 'save_count',
    page        = 1,
    page_size   = 20,
  } = filters;

  const supabase   = await createClient();
  const offset     = (page - 1) * page_size;

  // Base query: public templates with creator profile and exercise summary
  let query = supabase
    .from('workout_templates')
    .select(
      `
      id, user_id, name, description, color, estimated_duration_min,
      is_public, save_count, created_at, updated_at,
      creator:profiles!user_id ( display_name, avatar_url ),
      template_exercises (
        id, exercise_id, sort_order, target_sets, target_reps,
        target_weight_kg, rest_seconds, notes,
        exercises ( id, name, muscle_group, equipment, category )
      )
      `,
      { count: 'exact' },
    )
    .eq('is_public', true);

  // Fuzzy search on name and description
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term}`);
  }

  // Muscle group filter: only return templates that contain at least one
  // exercise matching any of the given muscle groups.
  // This is handled post-fetch since Supabase JS doesn't natively support
  // deep nested WHERE in select. A dedicated RPC is preferable at scale.
  // For now we filter in application code (page_size is small enough).

  // Sorting
  switch (sort) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'trending':
      // Approximate trending: order by save_count then recency
      // True trending score (decay function) should live in a DB view.
      query = query
        .order('save_count', { ascending: false })
        .order('updated_at',  { ascending: false });
      break;
    case 'save_count':
    default:
      query = query.order('save_count', { ascending: false });
      break;
  }

  query = query.range(offset, offset + page_size - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Marketplace query failed: ${error.message}`);

  let templates = (data ?? []) as unknown as PublicTemplate[];

  // Application-level muscle group filter (see note above)
  if (muscle_groups && muscle_groups.length > 0) {
    const groups = new Set(muscle_groups.map(g => g.toLowerCase()));
    templates = templates.filter(t =>
      (t.template_exercises ?? []).some(te =>
        te.exercises && groups.has(te.exercises.muscle_group.toLowerCase()),
      ),
    );
  }

  return { templates, total: count ?? 0 };
}

/**
 * Save (import) a public template to the current user's saved list.
 * Idempotent: re-saving the same template is a no-op.
 */
export async function saveTemplate(templateId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('template_saves')
    .upsert(
      { template_id: templateId, user_id: user.id },
      { onConflict: 'template_id,user_id', ignoreDuplicates: true },
    );

  if (error) throw new Error(`Failed to save template: ${error.message}`);
}

/**
 * Unsave a previously saved template.
 * Idempotent: unsaving an already-unsaved template is a no-op.
 */
export async function unsaveTemplate(templateId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('template_saves')
    .delete()
    .eq('template_id', templateId)
    .eq('user_id',     user.id);

  if (error) throw new Error(`Failed to unsave template: ${error.message}`);
}

/**
 * Return the set of template IDs the current user has saved.
 * Useful for decorating marketplace listings with a "saved" indicator.
 */
export async function getUserSavedTemplateIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('template_saves')
    .select('template_id');

  if (error) throw new Error(`Failed to load saved templates: ${error.message}`);
  return new Set((data ?? []).map(r => r.template_id));
}

/**
 * Publish or unpublish a template (owner only, enforced by RLS).
 */
export async function setTemplateVisibility(
  templateId: string,
  isPublic: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('workout_templates')
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (error) throw new Error(`Failed to update template visibility: ${error.message}`);
}
