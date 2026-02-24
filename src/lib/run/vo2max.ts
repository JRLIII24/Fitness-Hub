/**
 * VO2 Max Estimation — Jack Daniels VDOT Method
 *
 * Uses the Daniels/Gilbert aerobic demand and fractional utilization equations.
 * VDOT ≈ VO2max within ~5% for trained runners.
 */

export function estimateVdot(
  distanceM: number,
  durationMinutes: number
): number | null {
  if (distanceM < 1000 || durationMinutes < 5) return null;

  const velocityMMin = distanceM / durationMinutes;

  const vo2AtVelocity =
    -4.6 + 0.182258 * velocityMMin + 0.000104 * velocityMMin ** 2;

  const fractionUsed =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMinutes) +
    0.2989558 * Math.exp(-0.1932605 * durationMinutes);

  if (fractionUsed <= 0) return null;

  const vdot = vo2AtVelocity / fractionUsed;
  return Math.max(20, Math.min(90, parseFloat(vdot.toFixed(1))));
}

export function smoothVo2max(
  previousVo2max: number | null,
  newEstimate: number
): number {
  if (!previousVo2max) return newEstimate;
  return parseFloat((0.8 * previousVo2max + 0.2 * newEstimate).toFixed(1));
}
