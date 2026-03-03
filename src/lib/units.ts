// ── Unit Conversion Constants ──────────────────────────────────────────────
export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;
export const CM_TO_INCHES = 0.393701;
export const KM_TO_MI = 0.621371;

// ── Core Converters (no rounding) ──────────────────────────────────────────
export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

export function lbsToKg(lbs: number): number {
  return lbs * LBS_TO_KG;
}

// ── Display Converters (with rounding) ─────────────────────────────────────

/** Convert kg to display value with specified decimal precision. Default 1 decimal. */
export function kgToDisplayValue(kg: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(kgToLbs(kg) * factor) / factor;
}

/** Convert kg to the appropriate unit for display. Returns the numeric value. */
export function weightToDisplay(kg: number, isImperial: boolean, decimals: number = 1): number {
  if (!isImperial) {
    const factor = Math.pow(10, decimals);
    return Math.round(kg * factor) / factor;
  }
  return kgToDisplayValue(kg, decimals);
}

/** Get the weight unit label. */
export function weightUnit(isImperial: boolean): string {
  return isImperial ? "lbs" : "kg";
}
