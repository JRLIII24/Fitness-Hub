import type { RunIntensityZone } from "@/types/run";

const ZONE_INTENSITY_MULTIPLIERS: Record<RunIntensityZone, number> = {
  zone1_active_recovery: 0.7,
  zone2_aerobic: 0.85,
  zone3_tempo: 1.0,
  zone4_threshold: 1.15,
  zone5_anaerobic: 1.3,
};

export function computeRunSessionLoad(
  sessionRpe: number,
  durationSeconds: number,
  primaryZone: RunIntensityZone | null
): number {
  const durationMinutes = durationSeconds / 60;
  const multiplier = primaryZone
    ? ZONE_INTENSITY_MULTIPLIERS[primaryZone]
    : 1.0;
  return sessionRpe * durationMinutes * multiplier;
}

export function getRecoveryRecommendation(
  sessionLoad: number,
  currentFatigueScore: number
): string {
  const combinedStress = sessionLoad + currentFatigueScore;

  if (combinedStress > 120) {
    return "High total stress — take a full rest day or light mobility work tomorrow.";
  }
  if (combinedStress > 80) {
    return "Moderate stress — keep tomorrow's session easy or focus on upper body.";
  }
  if (combinedStress > 40) {
    return "Manageable load — you can train normally tomorrow.";
  }
  return "Light session — you're fresh for tomorrow's training.";
}

export function suggestLegDayIntensity(
  runLoadLast48h: number,
  currentFatigueScore: number
): "full" | "moderate" | "light" | "skip" {
  const legStress = runLoadLast48h * 0.6 + currentFatigueScore * 0.4;

  if (legStress > 80) return "skip";
  if (legStress > 60) return "light";
  if (legStress > 35) return "moderate";
  return "full";
}
