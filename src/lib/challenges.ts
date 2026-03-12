/**
 * Pod Challenges – Server-side Service Layer
 *
 * Responsibilities:
 *  - CRUD for pod_challenges
 *  - Leaderboard aggregation via RPC
 */

import { createClient } from '@/lib/supabase/server';
import type {
  PodChallenge,
  CreateChallengeInput,
  ChallengeLeaderboard,
  LeaderboardEntry,
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
    score_unit: scoreUnit(challenge.challenge_type as PodChallenge['challenge_type']),
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

