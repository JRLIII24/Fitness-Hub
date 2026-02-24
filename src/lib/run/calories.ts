import type { RunIntensityZone, ZoneBreakdown } from "@/types/run";

const ZONE_MET: Record<RunIntensityZone, number> = {
  zone1_active_recovery: 5.0,
  zone2_aerobic: 8.0,
  zone3_tempo: 10.0,
  zone4_threshold: 12.5,
  zone5_anaerobic: 16.0,
};

export function estimateCalories(
  zoneBreakdown: ZoneBreakdown,
  weightKg: number,
  totalDurationSeconds: number
): number {
  const total = Object.values(zoneBreakdown).reduce((a, b) => a + b, 0);
  if (total === 0 || weightKg <= 0) return 0;

  let weightedMet = 0;
  for (const [zone, seconds] of Object.entries(zoneBreakdown)) {
    const fraction = seconds / total;
    weightedMet += ZONE_MET[zone as RunIntensityZone] * fraction;
  }

  const durationHours = totalDurationSeconds / 3600;
  return Math.round(weightedMet * weightKg * durationHours);
}
