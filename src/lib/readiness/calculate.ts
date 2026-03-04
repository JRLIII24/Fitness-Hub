import type { ReadinessInputs, ReadinessResult, ReadinessLevel, HealthKitData } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeTrainingDomain(fatigueScore: number | null): number {
  if (fatigueScore == null) return 50;
  return clamp(100 - fatigueScore, 0, 100);
}

function computeNutritionDomain(
  compliance: { daysTracked: number; avgCaloriePct: number; avgProteinPct: number } | null
): number {
  if (!compliance || compliance.daysTracked === 0) return 50;

  const calScore = scoreCompliancePct(compliance.avgCaloriePct);
  const protScore = scoreCompliancePct(compliance.avgProteinPct);
  return Math.round(0.5 * calScore + 0.5 * protScore);
}

function scoreCompliancePct(pct: number): number {
  if (pct >= 70 && pct <= 120) return 90;
  if (pct < 70) {
    // Linear scale: 0% → 0, 70% → 90
    return Math.round((pct / 70) * 90);
  }
  // >120%: mild penalty, cap at 70
  // Linear from 120→90 to 200→70
  const penalty = ((pct - 120) / 80) * 20;
  return Math.round(Math.max(70, 90 - penalty));
}

function computeRecoveryDomain(recoveryRaw: number | null): number {
  if (recoveryRaw == null) return 50;
  // recoveryRaw is 0-10 (high = bad), invert: 10 - raw, then scale to 0-100
  const inverted = 10 - recoveryRaw;
  return clamp(Math.round(inverted * 10), 0, 100);
}

function computeExternalDomain(healthKit: HealthKitData | null): number | null {
  if (!healthKit) return null;

  const sleepScore = computeSleepScore(healthKit.sleepHours);
  const hrvScore = computeHrvScore(healthKit.hrvMs);
  const rhrScore = computeRhrScore(healthKit.restingHeartRate);

  if (sleepScore == null && hrvScore == null && rhrScore == null) return null;

  // Use available sub-scores with weighted fallback
  let total = 0;
  let weight = 0;

  if (sleepScore != null) { total += 0.5 * sleepScore; weight += 0.5; }
  if (hrvScore != null) { total += 0.25 * hrvScore; weight += 0.25; }
  if (rhrScore != null) { total += 0.25 * rhrScore; weight += 0.25; }

  return weight > 0 ? Math.round(total / weight) : null;
}

function computeSleepScore(hours: number | null): number | null {
  if (hours == null) return null;
  if (hours >= 9) return 100;
  if (hours >= 7) return Math.round(90 + ((hours - 7) / 2) * 10);
  if (hours <= 5) return 30;
  // 5-7h: linear 30→90
  return Math.round(30 + ((hours - 5) / 2) * 60);
}

function computeHrvScore(ms: number | null): number | null {
  if (ms == null) return null;
  if (ms >= 100) return 95;
  if (ms >= 80) return Math.round(90 + ((ms - 80) / 20) * 5);
  if (ms >= 50) return Math.round(60 + ((ms - 50) / 30) * 30);
  // <50: linear scale down
  return Math.round(Math.max(20, (ms / 50) * 60));
}

function computeRhrScore(bpm: number | null): number | null {
  if (bpm == null) return null;
  if (bpm <= 50) return 95;
  if (bpm <= 70) return Math.round(95 - ((bpm - 50) / 20) * 25);
  if (bpm >= 90) return 40;
  // 70-90: linear 70→40
  return Math.round(70 - ((bpm - 70) / 20) * 30);
}

function scoreToLevel(score: number): ReadinessLevel {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'rest';
}

const RECOMMENDATIONS: Record<ReadinessLevel, string> = {
  peak: "You're primed for a high-intensity session",
  good: "Good to train — consider your planned workout",
  moderate: "Moderate readiness — lighter volume recommended",
  low: "Recovery day recommended — focus on mobility",
  rest: "Full rest recommended — prioritize sleep and nutrition",
};

export function calculateReadiness(inputs: ReadinessInputs): ReadinessResult {
  const training = computeTrainingDomain(inputs.fatigueScore);
  const nutrition = computeNutritionDomain(inputs.nutritionCompliance);
  const recovery = computeRecoveryDomain(inputs.recoveryRaw);
  const external = computeExternalDomain(inputs.healthKit);

  const hasExternal = external != null;

  let readinessScore: number;
  if (hasExternal) {
    readinessScore = Math.round(
      0.35 * training + 0.20 * nutrition + 0.30 * recovery + 0.15 * external
    );
  } else {
    readinessScore = Math.round(
      0.40 * training + 0.25 * nutrition + 0.35 * recovery
    );
  }

  readinessScore = clamp(readinessScore, 0, 100);

  // Count non-null domains for confidence
  let domainCount = 0;
  if (inputs.fatigueScore != null) domainCount++;
  if (inputs.nutritionCompliance != null && inputs.nutritionCompliance.daysTracked > 0) domainCount++;
  if (inputs.recoveryRaw != null) domainCount++;
  if (external != null) domainCount++;

  const confidence = domainCount >= 3 ? 'high' : domainCount >= 2 ? 'medium' : 'low';

  const level = scoreToLevel(readinessScore);

  return {
    readinessScore,
    level,
    domains: { training, nutrition, recovery, external },
    confidence,
    recommendation: RECOMMENDATIONS[level],
  };
}
