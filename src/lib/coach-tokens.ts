/**
 * APEX Coach Design Tokens
 * Futuristic OKLCH color system for the AI coach interface.
 * All colors are perceptually vivid and intended for dark surfaces.
 */

export const T = {
  // APEX identity color — neon chartreuse (always APEX's brand)
  volt:        "oklch(0.88 0.26 135)",
  voltDim:     "oklch(0.65 0.20 135)",

  // State colors — futuristic, highly chromatic
  sky:         "oklch(0.82 0.24 195)",   // Electric cyan  — listening
  violet:      "oklch(0.72 0.32 285)",   // Ultra violet   — thinking
  amber:       "oklch(0.88 0.22 60)",    // Electric amber — speaking

  // Dark surfaces
  bgBase:      "oklch(0.10 0.01 264)",
  bgCard:      "oklch(0.14 0.01 264)",
  bgElevated:  "oklch(0.18 0.01 264)",

  // Borders
  border1:     "oklch(0.28 0.01 264 / 0.6)",
  border2:     "oklch(0.35 0.01 264 / 0.5)",

  // Semantic accents
  gold:        "oklch(0.80 0.15 85)",     // Carbs / gold accent
  ember:       "oklch(0.75 0.18 45)",     // Calories / fire
  success:     "oklch(0.72 0.18 145)",    // Green states
  error:       "oklch(0.65 0.22 25)",     // Red states

  // Text
  text1:       "oklch(0.98 0 0)",
  text2:       "oklch(0.60 0 0)",

  // Glass surfaces (liquid glass — very transparent)
  glassBg:       "rgba(255,255,255,0.07)",
  glassCard:     "rgba(255,255,255,0.055)",
  glassElevated: "rgba(255,255,255,0.07)",
  glassBorder:   "rgba(255,255,255,0.22)",

  // Shadows
  shadowVolt:  "0 4px 16px oklch(0.88 0.26 135 / 0.3)",

  // Border radius
  r8:   "8px",
  r10:  "10px",
  r12:  "12px",
  r14:  "14px",
  r16:  "16px",
  r20:  "20px",
  rFull: "9999px",

  // Fonts
  fontDisplay: "'Barlow Condensed', system-ui, sans-serif",
  fontSans:    "'Space Grotesk', system-ui, sans-serif",
} as const;

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/** Maps each orbState to its vivid APEX glow color */
export const orbColors: Record<OrbState, string> = {
  idle:      T.volt,
  listening: T.sky,
  thinking:  T.violet,
  speaking:  T.amber,
};

/** Human-readable coach status per orbState — used in tooltip and sheet header */
export const statusMessages: Record<OrbState, string> = {
  idle:      "Monitoring your session",
  listening: "Listening to you…",
  thinking:  "Analyzing your data…",
  speaking:  "Coaching you now",
};
