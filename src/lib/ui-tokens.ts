export const SURFACE_COLORS = {
  bg0: "#0D0F12",
  bg1: "#12151A",
  bg2: "#171B22",
  border: "#232936",
} as const;

export const PERFORMANCE_COLORS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
  fiber: "var(--macro-fiber)",
  sodium: "oklch(72% 0.14 220)",
  sugar: "oklch(72% 0.18 20)",
} as const;

export const ELEVATION_SHADOWS = {
  elev1: "0 2px 12px rgba(0,0,0,0.22)",
  elev2: "0 8px 24px rgba(0,0,0,0.28)",
  elev3: "0 16px 40px rgba(0,0,0,0.36)",
} as const;
