import type { FatigueRecommendation } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(x: number, x0: number, y0: number, x1: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

// Piecewise anchors aligned to spec:
// strain<=0.8 => ~25, 1.0 => ~45, 1.5 => ~70, >=2.0 => ~95
export function mapStrainToLoadSubscore(strain: number | null): number {
  if (strain == null || !Number.isFinite(strain)) return 45;
  const s = Math.max(0, strain);

  if (s <= 0.8) return 25;
  if (s <= 1.0) return Math.round(lerp(s, 0.8, 25, 1.0, 45));
  if (s <= 1.5) return Math.round(lerp(s, 1.0, 45, 1.5, 70));
  if (s <= 2.0) return Math.round(lerp(s, 1.5, 70, 2.0, 95));
  return 95;
}

export function mapRecoveryRawToSubscore(recoveryRaw: number | null): number {
  if (recoveryRaw == null || !Number.isFinite(recoveryRaw)) return 50;
  return clamp(Math.round(recoveryRaw * 10), 0, 100);
}

// delta > 0 means improved performance, < 0 means decline.
export function mapPerformanceDeltaToSubscore(
  performanceDelta: number | null,
  comparableEffort: boolean
): number {
  if (performanceDelta == null || !Number.isFinite(performanceDelta)) return 50;

  if (performanceDelta >= 0.03) return 25;
  if (performanceDelta >= 0) return 35;
  if (performanceDelta >= -0.03) return 45;
  if (performanceDelta >= -0.08) return 62;
  if (performanceDelta >= -0.14) return comparableEffort ? 80 : 70;
  return comparableEffort ? 92 : 82;
}

export function scoreToRecommendation(score: number): FatigueRecommendation {
  if (score <= 29) {
    return { label: "Fresh", guidance: "Train as planned." };
  }
  if (score <= 49) {
    return { label: "Normal", guidance: "Train as planned." };
  }
  if (score <= 69) {
    return {
      label: "Building fatigue",
      guidance: "Keep intensity, reduce volume 10-20%.",
    };
  }
  if (score <= 84) {
    return {
      label: "High fatigue",
      guidance: "Reduce volume 20-40% and focus on quality technique work.",
    };
  }
  return {
    label: "Very high fatigue",
    guidance: "Consider deload, rest day, or active recovery.",
  };
}
