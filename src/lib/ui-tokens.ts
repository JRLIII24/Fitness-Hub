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
  xs: "0 1px 4px rgba(0,0,0,0.30)",
  sm: "0 2px 12px rgba(0,0,0,0.50)",
  md: "0 4px 24px rgba(0,0,0,0.60)",
  lg: "0 8px 40px rgba(0,0,0,0.75)",
  xl: "0 16px 64px rgba(0,0,0,0.85)",
} as const;

export const BLOOM_SHADOWS = {
  volt: "0 8px 28px rgba(200,255,0,0.35)",
  sky: "0 6px 22px rgba(0,196,232,0.35)",
  violet: "0 6px 22px rgba(148,112,255,0.35)",
  mint: "0 6px 18px rgba(0,217,142,0.30)",
  ember: "0 6px 20px rgba(255,87,51,0.30)",
  crimson: "0 6px 20px rgba(255,59,92,0.30)",
  gold: "0 6px 20px rgba(255,149,0,0.30)",
} as const;

export const GLASS_SURFACES = {
  card: "glass-surface shimmer-target relative rounded-[20px]",
  hero: "glass-surface-hero shimmer-target relative rounded-[24px]",
  chip: "glass-chip rounded-full",
  nav: "glass-nav",
  modal: "glass-surface-modal relative rounded-[20px]",
  inner: "glass-inner rounded-[12px]",
} as const;
