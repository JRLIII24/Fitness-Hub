/**
 * POST   /api/templates/[id]/save  – bookmark a public template
 * DELETE /api/templates/[id]/save  – remove bookmark
 *
 * Idempotent: duplicate saves or non-existent unsaves are silently ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Guard: users cannot save their own templates
  const { data: tmpl } = await supabase
    .from('workout_templates')
    .select('user_id')
    .eq('id', id)
    .single();
  if (tmpl?.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot save your own template' }, { status: 403 });
  }

  const { error } = await supabase
    .from('template_saves')
    .upsert(
      { template_id: id, user_id: user.id },
      { onConflict: 'template_id,user_id', ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('template_saves')
    .delete()
    .eq('template_id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ saved: false });
}
