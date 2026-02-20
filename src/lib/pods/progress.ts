/**
 * Pod Progress Calculator
 * Calculates member progress towards weekly commitments
 */

import { createClient } from '@/lib/supabase/server';
import type { MemberProgress } from '@/types/pods';

/**
 * Get the start of the current ISO week (Monday)
 */
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = (dayOfWeek + 6) % 7; // Days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get member progress for all members in a pod
 */
export async function getPodMemberProgress(podId: string): Promise<MemberProgress[]> {
  const supabase = await createClient();
  const weekStart = getCurrentWeekStart();
  const weekStartISO = weekStart.toISOString();

  // Get all active members with their commitments
  const { data: members, error: membersError } = await supabase
    .from('pod_members')
    .select(`
      user_id,
      profiles!inner(display_name, username)
    `)
    .eq('pod_id', podId)
    .eq('status', 'active');

  if (membersError || !members) {
    console.error('Failed to fetch pod members:', membersError);
    return [];
  }

  // Get commitments for this week
  const { data: commitments } = await supabase
    .from('pod_commitments')
    .select('user_id, workouts_per_week')
    .eq('pod_id', podId)
    .eq('week_start_date', weekStart.toISOString().split('T')[0]);

  const commitmentMap = new Map(
    (commitments || []).map(c => [c.user_id, c.workouts_per_week])
  );

  // Get workout counts for this week
  const userIds = members.map(m => m.user_id);
  const { data: workouts } = await supabase
    .from('workout_sessions')
    .select('user_id, id')
    .in('user_id', userIds)
    .eq('status', 'completed')
    .gte('started_at', weekStartISO);

  const workoutCounts = new Map<string, number>();
  (workouts || []).forEach(w => {
    workoutCounts.set(w.user_id, (workoutCounts.get(w.user_id) || 0) + 1);
  });

  // Calculate progress for each member
  const progress: MemberProgress[] = await Promise.all(
    members.map(async (member) => {
      const commitment = commitmentMap.get(member.user_id) || 0;
      const completed = workoutCounts.get(member.user_id) || 0;
      const progress_percentage = commitment > 0 ? Math.min(100, Math.round((completed / commitment) * 100)) : 0;
      const is_on_track = completed >= commitment;

      // Calculate streak (consecutive weeks meeting goal)
      const streak = await calculateStreak(member.user_id, podId);

      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

      return {
        user_id: member.user_id,
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        commitment,
        completed,
        progress_percentage,
        is_on_track,
        streak
      };
    })
  );

  return progress;
}

/**
 * Calculate consecutive weeks user met their commitment
 */
async function calculateStreak(userId: string, podId: string): Promise<number> {
  const supabase = await createClient();
  let streak = 0;
  let currentWeek = getCurrentWeekStart();

  // Check last 12 weeks for streak
  for (let i = 0; i < 12; i++) {
    const weekStartDate = new Date(currentWeek);
    weekStartDate.setDate(currentWeek.getDate() - (i * 7));
    const weekStartISO = weekStartDate.toISOString().split('T')[0];
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 7);
    const weekEndISO = weekEndDate.toISOString();

    // Get commitment for this week
    const { data: commitment } = await supabase
      .from('pod_commitments')
      .select('workouts_per_week')
      .eq('pod_id', podId)
      .eq('user_id', userId)
      .eq('week_start_date', weekStartISO)
      .maybeSingle();

    if (!commitment) {
      // No commitment = can't count towards streak
      if (i === 0) continue; // Current week might not have commitment yet
      break;
    }

    // Count workouts in this week
    const { data: workouts } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', weekStartDate.toISOString())
      .lt('started_at', weekEndISO);

    const workoutCount = workouts?.length || 0;

    if (workoutCount >= commitment.workouts_per_week) {
      streak++;
    } else if (i > 0) {
      // Streak broken (allow current week to be incomplete)
      break;
    }
  }

  return streak;
}

/**
 * Check if a username exists and is available for pod invites
 */
export async function findUserByUsername(username: string): Promise<{ id: string; username: string; display_name: string | null } | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', username)
    .maybeSingle();

  return profile;
}

/**
 * Get current week's commitment for a user in a pod
 */
export async function getCurrentCommitment(userId: string, podId: string): Promise<number> {
  const supabase = await createClient();
  const weekStart = getCurrentWeekStart();
  const weekStartISO = weekStart.toISOString().split('T')[0];

  const { data: commitment } = await supabase
    .from('pod_commitments')
    .select('workouts_per_week')
    .eq('pod_id', podId)
    .eq('user_id', userId)
    .eq('week_start_date', weekStartISO)
    .maybeSingle();

  return commitment?.workouts_per_week || 0;
}
