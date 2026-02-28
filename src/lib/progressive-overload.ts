const KG_TO_LBS = 2.20462;

/**
 * Returns a suggested weight in **kg**, bumped by the standard plate increment
 * for the user's unit preference and snapped to the nearest available plate size.
 *
 * Always operates in true kg so the store stays metric. `SetRow` converts the
 * result to the user's preferred display unit for rendering.
 *
 * The result is display-only and should never be written to the store directly
 * by the caller; the autofill path in page.tsx writes it as `weight_kg`.
 */
export function calcSuggestedWeight(
  ghostKg: number,
  preference: "imperial" | "metric"
): number {
  if (preference === "imperial") {
    // Work in lbs, snap to nearest 2.5 lb plate
    const ghostLbs = ghostKg * KG_TO_LBS;
    const bump = ghostLbs < 100 ? 2.5 : 5;
    const snappedLbs = Math.round((ghostLbs + bump) / 2.5) * 2.5;
    return snappedLbs / KG_TO_LBS;
  }
  // metric: snap to nearest 1.25 kg (smallest standard plate pair)
  const bump = ghostKg < 50 ? 1.25 : 2.5;
  return Math.round((ghostKg + bump) / 1.25) * 1.25;
}
