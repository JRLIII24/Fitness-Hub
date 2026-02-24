/**
 * Template Import Service
 *
 * Provides an atomic, idempotent copy of a public community template into the
 * current user's personal library.
 *
 * Design:
 *   - Delegates to import_public_template() Postgres RPC (migration 042)
 *     which runs inside a single transaction: copy header + exercises + record
 *     save, all-or-nothing.
 *   - Idempotency: the RPC detects prior imports via description fingerprint
 *     and returns the existing copy's ID without re-inserting.
 *   - The template_saves trigger automatically increments save_count on the
 *     source template only on first import.
 */

import { createClient } from '@/lib/supabase/server';

export interface ImportResult {
  /** UUID of the newly created (or pre-existing) personal template copy */
  templateId: string;
  /** true if this was a fresh import, false if already imported previously */
  isNew: boolean;
}

/**
 * Import a public template into the calling user's library.
 *
 * @param sourceTemplateId - UUID of the public template to import
 * @returns ImportResult with the personal copy's ID
 * @throws if the template is not found, not public, or belongs to the caller
 */
export async function importPublicTemplate(
  sourceTemplateId: string,
): Promise<ImportResult> {
  const supabase = await createClient();

  // Check for pre-existing import before calling RPC (fast path, avoids
  // lock contention on concurrent imports of the same template)
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('workout_templates')
    .select('id')
    .eq('user_id', user.id)
    .like('description', `%[imported:${sourceTemplateId}]`)
    .maybeSingle();

  if (existing?.id) {
    return { templateId: existing.id, isNew: false };
  }

  // Delegate to the atomic Postgres RPC
  const { data, error } = await supabase
    .rpc('import_public_template', { p_template_id: sourceTemplateId });

  if (error) {
    // Surface user-friendly messages for known error conditions
    if (error.message.includes('not available for import')) {
      throw new Error('This template is no longer public or does not exist.');
    }
    if (error.message.includes('own template')) {
      throw new Error('You cannot import your own template.');
    }
    throw new Error(`Import failed: ${error.message}`);
  }

  return { templateId: data as string, isNew: true };
}

/**
 * Strip the import fingerprint suffix from a description for display purposes.
 * The fingerprint is never shown in the UI.
 */
export function stripImportFingerprint(description: string | null): string | null {
  if (!description) return null;
  return description.replace(/\s*\[imported:[0-9a-f-]{36}\]$/i, '').trim() || null;
}
