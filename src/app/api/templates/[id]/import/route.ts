/**
 * POST /api/templates/[id]/import
 *
 * Import a public community template into the caller's personal library.
 * The operation is atomic (single Postgres transaction) and idempotent
 * (re-importing returns the existing copy).
 *
 * Response (201 Created or 200 OK):
 *   { templateId: string, isNew: boolean }
 *
 * Error responses:
 *   401 – not authenticated
 *   400 – template not public, or caller is the owner
 *   404 – template not found
 *   500 – unexpected server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { importPublicTemplate }       from '@/lib/template-import';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  try {
    const result = await importPublicTemplate(id);

    return NextResponse.json(result, { status: result.isNew ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';

    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      message.includes('no longer public') ||
      message.includes('own template')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[POST /api/templates/[id]/import]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
