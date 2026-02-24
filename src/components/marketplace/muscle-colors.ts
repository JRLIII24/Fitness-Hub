/**
 * Muscle-group gradient palette used across marketplace components.
 * Colors are intentionally rich — inline style only (Tailwind can't purge dynamic values).
 */
export interface MuscleColor {
  from:        string;
  to:          string;
  labelColor:  string;
  borderAlpha: string;
  bgAlpha:     string;
}

const PALETTE: Record<string, MuscleColor> = {
  chest:       { from: '#f43f5e', to: '#9f1239', labelColor: '#f87171', borderAlpha: '#f43f5e44', bgAlpha: '#f43f5e18' },
  back:        { from: '#38bdf8', to: '#0369a1', labelColor: '#7dd3fc', borderAlpha: '#38bdf844', bgAlpha: '#38bdf818' },
  legs:        { from: '#a3e635', to: '#365314', labelColor: '#bef264', borderAlpha: '#a3e63544', bgAlpha: '#a3e63518' },
  arms:        { from: '#a78bfa', to: '#4c1d95', labelColor: '#c4b5fd', borderAlpha: '#a78bfa44', bgAlpha: '#a78bfa18' },
  shoulders:   { from: '#fb923c', to: '#9a3412', labelColor: '#fdba74', borderAlpha: '#fb923c44', bgAlpha: '#fb923c18' },
  core:        { from: '#fbbf24', to: '#92400e', labelColor: '#fcd34d', borderAlpha: '#fbbf2444', bgAlpha: '#fbbf2418' },
  hiit:        { from: '#f43f5e', to: '#7f1d1d', labelColor: '#fb7185', borderAlpha: '#f43f5e44', bgAlpha: '#f43f5e18' },
  cardio:      { from: '#34d399', to: '#065f46', labelColor: '#6ee7b7', borderAlpha: '#34d39944', bgAlpha: '#34d39918' },
  glutes:      { from: '#a3e635', to: '#3f6212', labelColor: '#bef264', borderAlpha: '#a3e63544', bgAlpha: '#a3e63518' },
  'full body': { from: '#38bdf8', to: '#7c3aed', labelColor: '#a78bfa', borderAlpha: '#38bdf844', bgAlpha: '#38bdf818' },
};

const DEFAULT: MuscleColor = {
  from: '#38bdf8', to: '#7c3aed',
  labelColor: '#a78bfa', borderAlpha: '#38bdf844', bgAlpha: '#38bdf818',
};

export function getMuscleColor(group: string): MuscleColor {
  return PALETTE[group.toLowerCase().trim()] ?? DEFAULT;
}

/** All filter categories shown in the marketplace pill row */
export const MUSCLE_FILTERS = [
  'All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'HIIT', 'Full Body', 'Cardio',
] as const;
export type MuscleFilter = typeof MUSCLE_FILTERS[number];
