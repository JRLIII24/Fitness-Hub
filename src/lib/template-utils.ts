/**
 * Shared template utilities — safe to import in both server and client components.
 * No server-only dependencies (no next/headers, no Supabase server client).
 */

/**
 * Strip the import fingerprint suffix appended by import_public_template()
 * so it is never shown in the UI.
 *
 * e.g. "Push Pull Legs [imported:550e8400-…]" → "Push Pull Legs"
 */
export function stripImportFingerprint(description: string | null): string | null {
  if (!description) return null;
  return description.replace(/\s*\[imported:[0-9a-f-]{36}\]$/i, '').trim() || null;
}

/**
 * Difficulty level display helper — convert database value to UI label and color
 */
export function getDifficultyInfo(level: string): { label: string; color: string; bg: string } {
  switch (level) {
    case "warm_up":
      return { label: "Warm Up", color: "#34d399", bg: "#34d39918" };
    case "grind":
      return { label: "Grind", color: "#fbbf24", bg: "#fbbf2418" };
    case "beast_mode":
      return { label: "Beast Mode", color: "#f43f5e", bg: "#f43f5e18" };
    default:
      return { label: "Grind", color: "#fbbf24", bg: "#fbbf2418" };
  }
}

export type DifficultyLevel = "warm_up" | "grind" | "beast_mode";

export const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string; description: string }[] = [
  {
    value: "warm_up",
    label: "Warm Up",
    description: "Light and easy — perfect for beginners or recovery days",
  },
  {
    value: "grind",
    label: "Grind",
    description: "Balanced intensity — steady progress and solid gains",
  },
  {
    value: "beast_mode",
    label: "Beast Mode",
    description: "Maximum intensity — for the experienced and determined",
  },
];
