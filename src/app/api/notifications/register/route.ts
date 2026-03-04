import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PUSH_NOTIFICATIONS_ENABLED } from '@/lib/features';

export async function POST(request: Request) {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { token, platform } = body as { token?: string; platform?: string };

  if (!token || !platform || !['ios', 'android', 'web'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid token or platform' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
