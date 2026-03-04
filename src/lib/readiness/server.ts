import { createClient } from '@/lib/supabase/server';
import { getUserTimezone, getDateInTimezone } from '@/lib/timezone';
import { getCachedOrComputeFatigueSnapshot } from '@/lib/fatigue/server';
import { deriveRecoveryRaw } from '@/lib/fatigue/calculate';
import { calculateReadiness } from './calculate';
import type { ReadinessResult, ReadinessLevel } from './types';

export async function computeAndCacheReadiness(userId: string): Promise<ReadinessResult> {
  const supabase = await createClient();
  const timezone = await getUserTimezone(userId);
  const today = getDateInTimezone(new Date(), timezone);

  // 1. Training domain: get fatigue score
  const fatigueSnapshot = await getCachedOrComputeFatigueSnapshot(userId);

  // 2. Nutrition domain: call RPC
  const { data: nutritionData } = await supabase.rpc('get_nutrition_compliance', {
    p_user_id: userId, p_days: 3
  });

  // 3. Recovery domain: get latest checkin
  const { data: checkin } = await supabase
    .from('fatigue_daily_checkins')
    .select('sleep_quality, soreness, stress, motivation')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })
    .limit(1)
    .single();

  const recoveryRaw = checkin ? deriveRecoveryRaw(checkin) : null;

  // 4. External domain: get latest health sync
  const { data: healthData } = await supabase
    .from('health_sync_data')
    .select('sleep_hours, resting_heart_rate, hrv_ms, steps')
    .eq('user_id', userId)
    .eq('sync_date', today)
    .limit(1)
    .single();

  const result = calculateReadiness({
    fatigueScore: fatigueSnapshot?.fatigueScore ?? null,
    nutritionCompliance: nutritionData?.[0] ? {
      daysTracked: nutritionData[0].days_tracked,
      avgCaloriePct: Number(nutritionData[0].avg_calorie_pct),
      avgProteinPct: Number(nutritionData[0].avg_protein_pct),
    } : null,
    recoveryRaw,
    healthKit: healthData ? {
      sleepHours: healthData.sleep_hours,
      restingHeartRate: healthData.resting_heart_rate,
      hrvMs: healthData.hrv_ms,
      steps: healthData.steps,
    } : null,
  });

  // Cache to DB (upsert)
  await supabase.from('readiness_daily_scores').upsert({
    user_id: userId,
    score_date: today,
    readiness_score: result.readinessScore,
    training_score: result.domains.training,
    nutrition_score: result.domains.nutrition,
    recovery_score: result.domains.recovery,
    external_score: result.domains.external,
    confidence: result.confidence,
    recommendation: result.recommendation,
  }, { onConflict: 'user_id,score_date' });

  return result;
}

function scoreToLevel(score: number): ReadinessLevel {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'rest';
}

export async function getCachedOrComputeReadiness(userId: string): Promise<ReadinessResult> {
  const supabase = await createClient();
  const timezone = await getUserTimezone(userId);
  const today = getDateInTimezone(new Date(), timezone);

  // Check cache
  const { data: cached } = await supabase
    .from('readiness_daily_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('score_date', today)
    .single();

  if (cached) {
    const level = scoreToLevel(cached.readiness_score);
    return {
      readinessScore: cached.readiness_score,
      level,
      domains: {
        training: cached.training_score ?? 50,
        nutrition: cached.nutrition_score ?? 50,
        recovery: cached.recovery_score ?? 50,
        external: cached.external_score,
      },
      confidence: cached.confidence as 'low' | 'medium' | 'high',
      recommendation: cached.recommendation,
    };
  }

  return computeAndCacheReadiness(userId);
}
