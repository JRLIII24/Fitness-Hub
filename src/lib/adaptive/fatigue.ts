/**
 * Fatigue Detection & Recovery Analysis
 * Calculates fatigue score (0-100) based on recent workout patterns
 */

import { createClient } from '@/lib/supabase/server';

interface WorkoutSession {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume_kg: number | null;
  status: string;
}

interface FatigueAnalysis {
  fatigueScore: number; // 0-100 (0 = fresh, 100 = extremely fatigued)
  recommendation: 'REST' | 'VOLUME' | 'INTENSITY';
  reason: string;
  metrics: {
    recentVolume: number;
    avgVolume: number;
    workoutsLast7Days: number;
    daysSinceLastWorkout: number;
    volumeTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

/**
 * Calculate fatigue score and workout recommendation
 */
export async function analyzeFatigue(userId: string): Promise<FatigueAnalysis> {
  const supabase = await createClient();
  const now = new Date();

  // Fetch last 30 days of completed workouts
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, started_at, duration_seconds, total_volume_kg, status')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', thirtyDaysAgo)
    .order('started_at', { ascending: false });

  const allSessions = (sessions || []) as WorkoutSession[];

  // Not enough data - recommend normal volume
  if (allSessions.length < 2) {
    return {
      fatigueScore: 30,
      recommendation: 'VOLUME',
      reason: 'Building baseline - continue normal training',
      metrics: {
        recentVolume: 0,
        avgVolume: 0,
        workoutsLast7Days: allSessions.length,
        daysSinceLastWorkout: 999,
        volumeTrend: 'stable'
      }
    };
  }

  // Calculate metrics
  const recentSessions = allSessions.filter(s => new Date(s.started_at) >= new Date(sevenDaysAgo));
  const lastSession = allSessions[0];
  const daysSinceLastWorkout = Math.floor((now.getTime() - new Date(lastSession.started_at).getTime()) / (24 * 60 * 60 * 1000));

  const recentVolume = recentSessions.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0);
  const avgVolume = allSessions.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0) / allSessions.length;
  const workoutsLast7Days = recentSessions.length;

  // Volume trend (last 7 days vs previous 7 days)
  const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const previousWeekEnd = new Date(sevenDaysAgo);
  const previousWeekSessions = allSessions.filter(s => {
    const sessionDate = new Date(s.started_at);
    return sessionDate >= previousWeekStart && sessionDate < previousWeekEnd;
  });
  const previousVolume = previousWeekSessions.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0);

  let volumeTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (previousVolume > 0) {
    const volumeChange = ((recentVolume - previousVolume) / previousVolume) * 100;
    if (volumeChange > 20) volumeTrend = 'increasing';
    else if (volumeChange < -20) volumeTrend = 'decreasing';
  }

  // Calculate fatigue score (0-100)
  let fatigueScore = 0;

  // Factor 1: High recent volume (max +25 points)
  if (recentVolume > avgVolume * 1.5) {
    fatigueScore += 25;
  } else if (recentVolume > avgVolume * 1.2) {
    fatigueScore += 15;
  }

  // Factor 2: High frequency (max +25 points)
  if (workoutsLast7Days >= 6) {
    fatigueScore += 25;
  } else if (workoutsLast7Days >= 5) {
    fatigueScore += 15;
  } else if (workoutsLast7Days >= 4) {
    fatigueScore += 10;
  }

  // Factor 3: Insufficient recovery (max +25 points)
  if (daysSinceLastWorkout === 0) {
    fatigueScore += 25; // Training again same day
  } else if (daysSinceLastWorkout === 1) {
    fatigueScore += 15; // Only 1 day rest
  } else if (daysSinceLastWorkout >= 7) {
    fatigueScore -= 20; // Well rested, reduce fatigue
  } else if (daysSinceLastWorkout >= 4) {
    fatigueScore -= 10; // Good rest
  }

  // Factor 4: Volume trend (max +25 points)
  if (volumeTrend === 'increasing' && recentVolume > avgVolume) {
    fatigueScore += 20; // Ramping up volume = accumulating fatigue
  } else if (volumeTrend === 'decreasing') {
    fatigueScore -= 10; // Recovering
  }

  // Clamp between 0-100
  fatigueScore = Math.max(0, Math.min(100, fatigueScore));

  // Determine recommendation
  let recommendation: 'REST' | 'VOLUME' | 'INTENSITY';
  let reason: string;

  if (fatigueScore >= 70) {
    recommendation = 'REST';
    reason = 'High fatigue detected - deload recommended for recovery';
  } else if (fatigueScore >= 50) {
    recommendation = 'REST';
    reason = 'Moderate fatigue - lighter session recommended';
  } else if (fatigueScore <= 20 && daysSinceLastWorkout >= 3) {
    recommendation = 'INTENSITY';
    reason = 'Well recovered - push for progressive overload';
  } else if (fatigueScore <= 30) {
    recommendation = 'INTENSITY';
    reason = 'Fresh and ready - increase volume or intensity';
  } else {
    recommendation = 'VOLUME';
    reason = 'Normal training - maintain current volume';
  }

  return {
    fatigueScore,
    recommendation,
    reason,
    metrics: {
      recentVolume: Math.round(recentVolume),
      avgVolume: Math.round(avgVolume),
      workoutsLast7Days,
      daysSinceLastWorkout,
      volumeTrend
    }
  };
}

/**
 * Format fatigue score as human-readable status
 */
export function getFatigueStatus(score: number): {
  label: string;
  color: string;
} {
  if (score >= 70) return { label: 'Very Fatigued', color: 'text-red-500' };
  if (score >= 50) return { label: 'Fatigued', color: 'text-orange-500' };
  if (score >= 30) return { label: 'Normal', color: 'text-yellow-500' };
  if (score >= 15) return { label: 'Fresh', color: 'text-green-500' };
  return { label: 'Very Fresh', color: 'text-emerald-500' };
}
