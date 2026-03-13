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
