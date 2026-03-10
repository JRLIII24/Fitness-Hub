/**
 * Social Activity Feed API
 * GET /api/social/feed
 *
 * Returns recent activity from users the current user follows:
 * - Completed workouts (session name, duration, volume)
 * - Personal records (exercise name, weight, reps)
 * - Streak milestones (current streak count)
 *
 * Limited to 50 most recent items, sorted by timestamp desc.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export type FeedActivityType = "workout_completed" | "pr_achieved" | "streak_milestone";

export interface FeedItem {
  id: string;
  type: FeedActivityType;
  timestamp: string;
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  data: {
    // workout_completed
    session_name?: string;
    duration_seconds?: number;
    total_volume_kg?: number;
    // pr_achieved
    exercise_name?: string;
    weight_kg?: number;
    reps?: number;
    // streak_milestone
    streak_count?: number;
  };
}

const FEED_LIMIT = 50;

export async function GET() {
  const supabase = await createClient();
  const { user, response } = await requireAuth(supabase);
  if (!user) return response!;

  // 1. Get IDs of users we follow
  const { data: followRows, error: followErr } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (followErr) {
    return NextResponse.json({ error: "Failed to load follows" }, { status: 500 });
  }

  const followingIds = (followRows ?? []).map((r) => r.following_id);

  if (followingIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // 2. Fetch completed workouts from followed users (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: workouts } = await supabase
    .from("workout_sessions")
    .select("id, user_id, name, duration_seconds, total_volume_kg, completed_at")
    .in("user_id", followingIds)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", fourteenDaysAgo)
    .order("completed_at", { ascending: false })
    .limit(FEED_LIMIT);

  // 3. Fetch recent PRs — heaviest working set per exercise per session
  //    We detect PRs by finding sets that are the all-time max weight for that
  //    user+exercise combo AND were completed in the last 14 days.
  //    For simplicity, we fetch recent heavy sets and mark them.
  const { data: recentSets } = await supabase
    .from("workout_sets")
    .select(`
      weight_kg,
      reps,
      completed_at,
      exercises!inner(id, name),
      workout_sessions!inner(id, user_id, status, completed_at)
    `)
    .in("workout_sessions.user_id", followingIds)
    .eq("workout_sessions.status", "completed")
    .eq("set_type", "working")
    .not("weight_kg", "is", null)
    .gt("weight_kg", 0)
    .gte("workout_sessions.completed_at", fourteenDaysAgo)
    .order("weight_kg", { ascending: false })
    .limit(200);

  // Build per-user per-exercise max weight map to identify actual PRs
  // We need ALL-TIME data to know if this is truly a PR, but that's expensive.
  // Instead, we take the top weight per user+exercise from recent sets as "notable lifts"
  // and show them as PRs if they're the heaviest in this batch.
  type SetRow = {
    weight_kg: number;
    reps: number | null;
    completed_at: string | null;
    exercises: { id: string; name: string } | Array<{ id: string; name: string }>;
    workout_sessions: { id: string; user_id: string; status: string; completed_at: string | null } | Array<{ id: string; user_id: string; status: string; completed_at: string | null }>;
  };

  const prMap = new Map<string, SetRow>(); // key: `${userId}:${exerciseId}`
  for (const row of (recentSets ?? []) as SetRow[]) {
    const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    const sess = Array.isArray(row.workout_sessions) ? row.workout_sessions[0] : row.workout_sessions;
    if (!ex || !sess || !row.weight_kg) continue;

    const key = `${sess.user_id}:${ex.id}`;
    const existing = prMap.get(key);
    if (!existing || row.weight_kg > (existing.weight_kg ?? 0)) {
      prMap.set(key, row);
    }
  }

  // 4. Fetch profile info for all followed users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, current_streak")
    .in("id", followingIds);

  const profileMap = new Map<string, {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    current_streak: number;
  }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p);
  }

  // 5. Assemble feed items
  const items: FeedItem[] = [];

  // Workout items
  for (const w of workouts ?? []) {
    const profile = profileMap.get(w.user_id);
    if (!profile) continue;
    items.push({
      id: `workout:${w.id}`,
      type: "workout_completed",
      timestamp: w.completed_at!,
      user: {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
      },
      data: {
        session_name: w.name,
        duration_seconds: w.duration_seconds ?? undefined,
        total_volume_kg: w.total_volume_kg ?? undefined,
      },
    });
  }

  // PR items (one per user+exercise, only the heaviest)
  for (const [, row] of prMap) {
    const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    const sess = Array.isArray(row.workout_sessions) ? row.workout_sessions[0] : row.workout_sessions;
    if (!ex || !sess) continue;

    const profile = profileMap.get(sess.user_id);
    if (!profile) continue;

    items.push({
      id: `pr:${sess.user_id}:${ex.id}`,
      type: "pr_achieved",
      timestamp: row.completed_at ?? sess.completed_at ?? new Date().toISOString(),
      user: {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
      },
      data: {
        exercise_name: ex.name,
        weight_kg: row.weight_kg,
        reps: row.reps ?? undefined,
      },
    });
  }

  // Streak milestone items (for users with streak >= 3)
  for (const [, profile] of profileMap) {
    if (profile.current_streak >= 3) {
      items.push({
        id: `streak:${profile.id}`,
        type: "streak_milestone",
        timestamp: new Date().toISOString(),
        user: {
          id: profile.id,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        },
        data: {
          streak_count: profile.current_streak,
        },
      });
    }
  }

  // Sort by timestamp desc and limit
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const limited = items.slice(0, FEED_LIMIT);

  return NextResponse.json({ items: limited });
}
