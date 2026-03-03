import { createClient } from "@/lib/supabase/server";
import { getDateInTimezone, toDayKeyInTimezone } from "@/lib/timezone";
import { calculateFatigueScore, deriveRecoveryRaw } from "./calculate";
import type { FatigueInputs, FatigueSnapshot, RecoveryCheckinInput } from "./types";

const COMPOUND_CATEGORIES = new Set(["compound"]);

function toMinutes(durationSeconds: number | null): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  return durationSeconds / 60;
}

function computeSessionLoad(durationSeconds: number | null, sessionRpe: number | null): number | null {
  const mins = toMinutes(durationSeconds);
  if (!mins || sessionRpe == null) return null;
  return sessionRpe * mins;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

async function getUserTimezone(userId: string, fallbackTz?: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  return (
    data?.timezone ||
    fallbackTz ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC"
  );
}

async function persistUserTimezone(userId: string, timezone: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", userId)
    .is("timezone", null);
}

type SessionRow = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  session_rpe: number | null;
};

type CheckinRow = {
  sleep_quality: number;
  soreness: number;
  stress: number;
  motivation: number;
};

export async function computeAndCacheFatigueSnapshot(
  userId: string,
  options?: { timezone?: string }
): Promise<FatigueSnapshot> {
  const supabase = await createClient();
  const timezone = await getUserTimezone(userId, options?.timezone);
  if (options?.timezone) {
    await persistUserTimezone(userId, options.timezone);
  }

  const now = new Date();
  const today = getDateInTimezone(now, timezone);
  const fortyTwoDaysAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: sessions }, { data: checkin }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id,started_at,duration_seconds,session_rpe")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", fortyTwoDaysAgo)
      .order("started_at", { ascending: false }),
    supabase
      .from("fatigue_daily_checkins")
      .select("sleep_quality,soreness,stress,motivation")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .maybeSingle(),
  ]);

  const sessionRows = (sessions ?? []) as SessionRow[];
  const recentSessions = sessionRows.filter(
    (s) => toDayKeyInTimezone(s.started_at, timezone) >= getDateInTimezone(new Date(now.getTime() - 28 * 86400000), timezone)
  );

  const loadEntries = sessionRows
    .map((s) => ({
      day: toDayKeyInTimezone(s.started_at, timezone),
      load: computeSessionLoad(s.duration_seconds, s.session_rpe),
    }))
    .filter((x): x is { day: string; load: number } => x.load != null);

  const loads7d = loadEntries
    .filter((x) => x.day >= getDateInTimezone(new Date(now.getTime() - 7 * 86400000), timezone))
    .map((x) => x.load);

  const loads28d = loadEntries
    .filter((x) => x.day >= getDateInTimezone(new Date(now.getTime() - 28 * 86400000), timezone))
    .map((x) => x.load);

  const sessionsToday = loadEntries.filter((x) => x.day === today);
  const sessionLoadToday = sessionsToday.reduce((sum, x) => sum + x.load, 0) || null;
  const avgLoad7d = loads7d.length ? loads7d.reduce((a, b) => a + b, 0) / loads7d.length : null;
  const avgLoad28d = loads28d.length ? loads28d.reduce((a, b) => a + b, 0) / loads28d.length : null;
  const strain = sessionLoadToday != null ? sessionLoadToday / Math.max(avgLoad7d ?? 0, 1) : null;

  const { data: perfRows } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id,reps,weight_kg,rpe,rir,completed_at,workout_sessions!inner(user_id,status,started_at),exercises!inner(category)"
    )
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .gte("completed_at", fortyTwoDaysAgo)
    .not("completed_at", "is", null)
    .not("reps", "is", null)
    .not("weight_kg", "is", null)
    .order("completed_at", { ascending: false });

  const compoundRows = (perfRows ?? []).filter((row) => {
    const exercise = Array.isArray(row?.exercises) ? row.exercises[0] : row?.exercises;
    const category = exercise?.category;
    return typeof category === "string" && COMPOUND_CATEGORIES.has(category);
  });

  const lifts = new Map<string, typeof compoundRows>();
  for (const row of compoundRows) {
    const list = lifts.get(row.exercise_id) ?? [];
    list.push(row);
    lifts.set(row.exercise_id, list);
  }

  let performanceDelta: number | null = null;
  let comparableEffort = false;

  const liftDeltas: number[] = [];
  let comparableCount = 0;

  for (const rows of lifts.values()) {
    const topSet = rows
      .filter((r) => r.reps != null && r.weight_kg != null)
      .sort((a, b) => e1rm(b.weight_kg, b.reps) - e1rm(a.weight_kg, a.reps))[0];

    if (!topSet) continue;

    const topSetDate = new Date(topSet.completed_at).getTime();
    const baselineStart = topSetDate - 14 * 86400000;
    const baselineCandidates = rows.filter((r) => {
      const t = new Date(r.completed_at).getTime();
      return t < topSetDate && t >= baselineStart;
    });

    const baselineE1rms = baselineCandidates
      .map((r) => (r.weight_kg != null && r.reps != null ? e1rm(r.weight_kg, r.reps) : null))
      .filter((v): v is number => v != null);

    const baselineMedian = median(baselineE1rms);
    if (!baselineMedian || baselineMedian <= 0) continue;

    const topE1rm = e1rm(topSet.weight_kg, topSet.reps);
    const delta = (topE1rm - baselineMedian) / baselineMedian;

    const baselineWithEffort = baselineCandidates.find(
      (r) => (r.rpe != null && topSet.rpe != null && Math.abs(r.rpe - topSet.rpe) <= 1) ||
             (r.rir != null && topSet.rir != null && Math.abs(r.rir - topSet.rir) <= 1)
    );

    if (baselineWithEffort) {
      comparableCount += 1;
    }

    liftDeltas.push(delta);
  }

  if (liftDeltas.length > 0) {
    performanceDelta = liftDeltas.reduce((a, b) => a + b, 0) / liftDeltas.length;
    comparableEffort = comparableCount > 0;
  }

  const recoveryRaw = deriveRecoveryRaw((checkin as CheckinRow | null) ?? null);

  const inputs: FatigueInputs = {
    sessionLoadToday,
    avgLoad7d,
    avgLoad28d,
    strain,
    recoveryRaw,
    performanceDelta,
    performanceComparableEffort: comparableEffort,
    hasRecoveryCheckin: Boolean(checkin),
    hasPerformanceHistory: performanceDelta != null,
    hasLoadData: sessionLoadToday != null || (avgLoad7d != null && avgLoad28d != null),
  };

  const result = calculateFatigueScore(inputs);

  const needsSessionRpe = recentSessions.some((s) => s.session_rpe == null);
  const hasRecentSessions = recentSessions.length > 0;

  const snapshot: FatigueSnapshot = {
    scoreDate: today,
    timezone,
    fatigueScore: result.fatigueScore,
    loadSubscore: result.loadSubscore,
    recoverySubscore: result.recoverySubscore,
    performanceSubscore: result.performanceSubscore,
    confidence: result.confidence,
    recommendation: result.recommendation,
    hasRecoveryCheckin: Boolean(checkin),
    hasRecentSessions,
    needsSessionRpe,
    metadata: {
      strain,
      sessionLoadToday,
      avgLoad7d,
      avgLoad28d,
      performanceDelta,
    },
  };

  await supabase
    .from("fatigue_daily_scores")
    .upsert(
      {
        user_id: userId,
        score_date: today,
        timezone,
        fatigue_score: snapshot.fatigueScore,
        load_subscore: snapshot.loadSubscore,
        recovery_subscore: snapshot.recoverySubscore,
        performance_subscore: snapshot.performanceSubscore,
        strain,
        session_load_today: sessionLoadToday,
        avg_load_7d: avgLoad7d,
        avg_load_28d: avgLoad28d,
        performance_delta: performanceDelta,
        recommendation: snapshot.recommendation.label,
        confidence: snapshot.confidence,
        inputs: {
          hasRecoveryCheckin: snapshot.hasRecoveryCheckin,
          hasRecentSessions: snapshot.hasRecentSessions,
          needsSessionRpe: snapshot.needsSessionRpe,
          guidance: snapshot.recommendation.guidance,
        },
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,score_date" }
    );

  return snapshot;
}

export async function getCachedOrComputeFatigueSnapshot(
  userId: string,
  options?: { timezone?: string }
): Promise<FatigueSnapshot> {
  const supabase = await createClient();
  const timezone = await getUserTimezone(userId, options?.timezone);
  const today = getDateInTimezone(new Date(), timezone);

  const { data: cached } = await supabase
    .from("fatigue_daily_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("score_date", today)
    .maybeSingle();

  if (cached) {
    const inputs = (cached.inputs as Record<string, unknown> | null) ?? {};
    return {
      scoreDate: cached.score_date,
      timezone: cached.timezone,
      fatigueScore: cached.fatigue_score,
      loadSubscore: cached.load_subscore,
      recoverySubscore: cached.recovery_subscore,
      performanceSubscore: cached.performance_subscore,
      confidence: cached.confidence,
      recommendation: {
        label: cached.recommendation as FatigueSnapshot["recommendation"]["label"],
        guidance:
          (typeof inputs.guidance === "string" && inputs.guidance) ||
          "Train based on readiness and consistency.",
      },
      hasRecoveryCheckin: Boolean(inputs.hasRecoveryCheckin),
      hasRecentSessions: Boolean(inputs.hasRecentSessions),
      needsSessionRpe: Boolean(inputs.needsSessionRpe),
      metadata: {
        strain: cached.strain,
        sessionLoadToday: cached.session_load_today,
        avgLoad7d: cached.avg_load_7d,
        avgLoad28d: cached.avg_load_28d,
        performanceDelta: cached.performance_delta,
      },
    };
  }

  return computeAndCacheFatigueSnapshot(userId, options);
}

export async function upsertDailyRecoveryCheckin(
  userId: string,
  payload: RecoveryCheckinInput,
  options?: { timezone?: string }
): Promise<FatigueSnapshot> {
  const supabase = await createClient();
  const timezone = await getUserTimezone(userId, options?.timezone);
  const today = getDateInTimezone(new Date(), timezone);

  if (options?.timezone) {
    await persistUserTimezone(userId, options.timezone);
  }

  await supabase.from("fatigue_daily_checkins").upsert(
    {
      user_id: userId,
      checkin_date: today,
      timezone,
      sleep_quality: payload.sleep_quality,
      soreness: payload.soreness,
      stress: payload.stress,
      motivation: payload.motivation,
      notes: payload.notes ?? null,
    },
    { onConflict: "user_id,checkin_date" }
  );

  return computeAndCacheFatigueSnapshot(userId, { timezone });
}

export async function saveSessionRpeAndRecompute(
  userId: string,
  sessionId: string,
  sessionRpe: number,
  options?: { timezone?: string }
): Promise<FatigueSnapshot> {
  const supabase = await createClient();
  await supabase
    .from("workout_sessions")
    .update({ session_rpe: sessionRpe })
    .eq("id", sessionId)
    .eq("user_id", userId);

  return computeAndCacheFatigueSnapshot(userId, options);
}
