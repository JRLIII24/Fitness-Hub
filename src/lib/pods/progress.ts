/**
 * Pod Progress Calculator
 * Calculates member progress towards weekly commitments
 * All date logic is timezone-aware per member.
 */

import { createClient } from '@/lib/supabase/server';
import { getDateInTimezone } from '@/lib/timezone';
import type { MemberProgress } from '@/types/pods';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Get Monday (ISO week start) for the week containing a YYYY-MM-DD date string.
 */
function getWeekStartDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun
  const diff = (dow + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Get day name ('mon','tue',...) from a YYYY-MM-DD string.
 */
function dayNameFromDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

/**
 * Get the start of the current ISO week (Monday) in a given timezone.
 * Returns YYYY-MM-DD string.
 */
export function getCurrentWeekStart(timezone = 'UTC'): string {
  const todayStr = getDateInTimezone(new Date(), timezone);
  return getWeekStartDate(todayStr);
}

/**
 * Get member progress for all members in a pod
 */
export async function getPodMemberProgress(podId: string): Promise<MemberProgress[]> {
  const supabase = await createClient();

  // Get all active members with their profiles (including timezone)
  const { data: members, error: membersError } = await supabase
    .from('pod_members')
    .select(`
      user_id,
      profiles!inner(display_name, username, avatar_url, preferred_workout_days, timezone)
    `)
    .eq('pod_id', podId)
    .eq('status', 'active');

  if (membersError || !members) {
    console.error('Failed to fetch pod members:', membersError);
    return [];
  }

  // Use a safe global week start for the DB query (earliest possible Monday across all timezones)
  // UTC-12 is the furthest behind, so go back 1 extra day from UTC Monday
  const utcWeekStart = getCurrentWeekStart('UTC');
  const safeQueryStart = new Date(utcWeekStart + 'T00:00:00Z');
  safeQueryStart.setDate(safeQueryStart.getDate() - 1);
  const safeQueryStartISO = safeQueryStart.toISOString();

  // Get commitments — we need to check multiple possible week_start_dates
  // since different timezones may have different Mondays
  const uniqueWeekStarts = new Set<string>();
  const memberTimezones = new Map<string, string>();

  for (const member of members) {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    const tz = (profile as Record<string, unknown>)?.timezone as string || 'UTC';
    memberTimezones.set(member.user_id, tz);
    uniqueWeekStarts.add(getCurrentWeekStart(tz));
  }

  // Get commitments for all relevant week starts
  let commitments: Array<{ user_id: string; workouts_per_week: number; planned_days?: string[]; week_start_date?: string }> | null = null;
  const weekStartArray = Array.from(uniqueWeekStarts);

  const fullQuery = await supabase
    .from('pod_commitments')
    .select('user_id, workouts_per_week, planned_days, week_start_date')
    .eq('pod_id', podId)
    .in('week_start_date', weekStartArray);

  if (fullQuery.error?.message?.includes('planned_days')) {
    const fallback = await supabase
      .from('pod_commitments')
      .select('user_id, workouts_per_week, week_start_date')
      .eq('pod_id', podId)
      .in('week_start_date', weekStartArray);
    commitments = (fallback.data || []).map(c => ({ ...c, planned_days: [] }));
  } else {
    commitments = fullQuery.data || [];
  }

  // Build commitment map keyed by `userId:weekStartDate`
  const commitmentMap = new Map(
    (commitments || []).map(c => [
      `${c.user_id}:${c.week_start_date}`,
      { workouts_per_week: c.workouts_per_week, planned_days: c.planned_days ?? [] },
    ])
  );

  // Get all workouts from the safe start to now
  const userIds = members.map(m => m.user_id);
  const { data: workouts } = await supabase
    .from('workout_sessions')
    .select('user_id, id, started_at, total_volume_kg')
    .in('user_id', userIds)
    .eq('status', 'completed')
    .gte('started_at', safeQueryStartISO);

  // Group workouts by user_id
  const workoutsByUser = new Map<string, typeof workouts>();
  (workouts || []).forEach(w => {
    const list = workoutsByUser.get(w.user_id) || [];
    list.push(w);
    workoutsByUser.set(w.user_id, list);
  });

  // Calculate progress for each member (timezone-aware)
  const progress: MemberProgress[] = await Promise.all(
    members.map(async (member) => {
      const tz = memberTimezones.get(member.user_id) || 'UTC';
      const memberWeekStart = getCurrentWeekStart(tz);
      const entry = commitmentMap.get(`${member.user_id}:${memberWeekStart}`) || { workouts_per_week: 0, planned_days: [] };
      const commitment = entry.workouts_per_week;

      // Filter & process workouts in member's timezone
      const memberWorkouts = workoutsByUser.get(member.user_id) || [];
      let completed = 0;
      const completedDays: string[] = [];
      let volumeKg = 0;

      for (const w of memberWorkouts) {
        // Convert workout start time to member's timezone date
        const workoutDateStr = getDateInTimezone(new Date(w.started_at), tz);
        const workoutWeekStart = getWeekStartDate(workoutDateStr);

        // Only count workouts in this member's current week
        if (workoutWeekStart !== memberWeekStart) continue;

        completed++;
        volumeKg += w.total_volume_kg || 0;

        const dayName = dayNameFromDateStr(workoutDateStr);
        if (!completedDays.includes(dayName)) completedDays.push(dayName);
      }

      const progress_percentage = commitment > 0 ? Math.min(100, Math.round((completed / commitment) * 100)) : 0;
      const is_on_track = completed >= commitment;

      const streak = await calculateStreak(member.user_id, podId, tz);

      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

      return {
        user_id: member.user_id,
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        commitment,
        planned_days: entry.planned_days,
        completed,
        completed_days: completedDays,
        progress_percentage,
        is_on_track,
        streak,
        volume_kg: volumeKg,
        preferred_workout_days: (profile as Record<string, unknown>)?.preferred_workout_days as number[] | null ?? null,
      };
    })
  );

  return progress;
}

/**
 * Calculate consecutive weeks user met their commitment
 */
async function calculateStreak(userId: string, podId: string, timezone = 'UTC'): Promise<number> {
  const supabase = await createClient();
  let streak = 0;
  const currentWeekStart = getCurrentWeekStart(timezone);

  for (let i = 0; i < 12; i++) {
    // Compute week start i weeks ago
    const [y, m, d] = currentWeekStart.split('-').map(Number);
    const weekDate = new Date(y, m - 1, d);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekStartISO = `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`;

    // Week end = 7 days after week start
    const weekEndDate = new Date(weekDate);
    weekEndDate.setDate(weekDate.getDate() + 7);
    const weekEndISO = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`;

    const { data: commitment } = await supabase
      .from('pod_commitments')
      .select('workouts_per_week')
      .eq('pod_id', podId)
      .eq('user_id', userId)
      .eq('week_start_date', weekStartISO)
      .maybeSingle();

    if (!commitment) {
      if (i === 0) continue;
      break;
    }

    // Count workouts in this week using timezone-aware date comparison
    // Query a wide range and filter by timezone-local date
    const queryStart = new Date(weekStartISO + 'T00:00:00Z');
    queryStart.setDate(queryStart.getDate() - 1); // buffer for timezone offset
    const queryEnd = new Date(weekEndISO + 'T00:00:00Z');
    queryEnd.setDate(queryEnd.getDate() + 1); // buffer

    const { data: workouts } = await supabase
      .from('workout_sessions')
      .select('id, started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', queryStart.toISOString())
      .lt('started_at', queryEnd.toISOString());

    // Filter to workouts whose timezone-local date falls within this week
    let workoutCount = 0;
    for (const w of workouts || []) {
      const wDateStr = getDateInTimezone(new Date(w.started_at), timezone);
      if (wDateStr >= weekStartISO && wDateStr < weekEndISO) {
        workoutCount++;
      }
    }

    if (workoutCount >= commitment.workouts_per_week) {
      streak++;
    } else if (i > 0) {
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

  return profile as { id: string; username: string; display_name: string | null } | null;
}

/**
 * Get current week's commitment for a user in a pod (timezone-aware)
 */
export async function getCurrentCommitment(userId: string, podId: string): Promise<number> {
  const supabase = await createClient();

  // Get user timezone
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  const tz = profile?.timezone || 'UTC';
  const weekStartISO = getCurrentWeekStart(tz);

  const { data: commitment } = await supabase
    .from('pod_commitments')
    .select('workouts_per_week')
    .eq('pod_id', podId)
    .eq('user_id', userId)
    .eq('week_start_date', weekStartISO)
    .maybeSingle();

  return commitment?.workouts_per_week || 0;
}
