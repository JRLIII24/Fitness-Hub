import { mapPerformanceDeltaToSubscore, mapRecoveryRawToSubscore, mapStrainToLoadSubscore, scoreToRecommendation, clamp } from "./mapping";
import type { FatigueInputs, FatigueResult } from "./types";

export function deriveRecoveryRaw(checkin: {
  sleep_quality: number;
  soreness: number;
  stress: number;
  motivation: number;
} | null): number | null {
  if (!checkin) return null;

  const sleepBad = 10 - checkin.sleep_quality;
  const motivationLow = 10 - checkin.motivation;
  return (sleepBad + motivationLow + checkin.soreness + checkin.stress) / 4;
}

export function calculateFatigueScore(input: FatigueInputs): FatigueResult {
  const loadSubscore = mapStrainToLoadSubscore(input.strain);
  const recoverySubscore = mapRecoveryRawToSubscore(input.recoveryRaw);
  const performanceSubscore = mapPerformanceDeltaToSubscore(
    input.performanceDelta,
    input.performanceComparableEffort
  );

  const blended =
    0.4 * loadSubscore +
    0.35 * recoverySubscore +
    0.25 * performanceSubscore;

  const fatigueScore = clamp(Math.round(blended), 0, 100);

  const presentDomains = [input.hasLoadData, input.hasRecoveryCheckin, input.hasPerformanceHistory]
    .filter(Boolean)
    .length;

  const confidence = presentDomains >= 3 ? "high" : presentDomains >= 2 ? "medium" : "low";

  return {
    fatigueScore,
    loadSubscore,
    recoverySubscore,
    performanceSubscore,
    confidence,
    recommendation: scoreToRecommendation(fatigueScore),
  };
}
