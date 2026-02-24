import type { RunIntensityZone, RunTag, ZoneBreakdown } from "@/types/run";

const DEFAULT_THRESHOLD_PACE_SEC_PER_KM = 330; // 5:30/km

export interface ZoneThresholds {
  zone4Max: number;
  zone3Max: number;
  zone2Max: number;
  zone1Max: number;
}

export function computeZoneThresholds(
  thresholdPaceSecPerKm: number = DEFAULT_THRESHOLD_PACE_SEC_PER_KM
): ZoneThresholds {
  return {
    zone4Max: thresholdPaceSecPerKm * 0.97,
    zone3Max: thresholdPaceSecPerKm * 1.06,
    zone2Max: thresholdPaceSecPerKm * 1.2,
    zone1Max: thresholdPaceSecPerKm * 1.4,
  };
}

export function classifyPaceZone(
  paceSecPerKm: number,
  thresholds: ZoneThresholds
): RunIntensityZone {
  if (paceSecPerKm <= 0) return "zone1_active_recovery";
  if (paceSecPerKm < thresholds.zone4Max) return "zone5_anaerobic";
  if (paceSecPerKm < thresholds.zone3Max) return "zone4_threshold";
  if (paceSecPerKm < thresholds.zone2Max) return "zone3_tempo";
  if (paceSecPerKm < thresholds.zone1Max) return "zone2_aerobic";
  return "zone1_active_recovery";
}

export function classifyZoneFromRpe(rpe: number): RunIntensityZone {
  if (rpe >= 9) return "zone5_anaerobic";
  if (rpe >= 8) return "zone4_threshold";
  if (rpe >= 6) return "zone3_tempo";
  if (rpe >= 4) return "zone2_aerobic";
  return "zone1_active_recovery";
}

export function getPrimaryZone(
  breakdown: ZoneBreakdown
): RunIntensityZone {
  const entries = Object.entries(breakdown) as Array<[RunIntensityZone, number]>;
  let maxZone: RunIntensityZone = "zone2_aerobic";
  let maxSeconds = 0;

  for (const [zone, seconds] of entries) {
    if (seconds > maxSeconds) {
      maxSeconds = seconds;
      maxZone = zone;
    }
  }

  return maxZone;
}

export function recommendRunTag(zoneBreakdown: ZoneBreakdown): RunTag {
  const total = Object.values(zoneBreakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return "easy";

  const zone2Pct = zoneBreakdown.zone2_aerobic / total;
  const zone3Pct = zoneBreakdown.zone3_tempo / total;
  const zone45Pct =
    (zoneBreakdown.zone4_threshold + zoneBreakdown.zone5_anaerobic) / total;
  const zone1Pct = zoneBreakdown.zone1_active_recovery / total;

  if (zone45Pct > 0.3) return "hiit";
  if (zone3Pct > 0.5) return "tempo";
  if (zone1Pct > 0.6) return "recovery";
  if (zone2Pct > 0.7) return "conditioning";
  return "easy";
}
