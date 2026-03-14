import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PUSH_NOTIFICATIONS_ENABLED } from '@/lib/features';

const RegisterTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(['ios', 'android', 'web']),
});

export async function POST(request: Request) {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const parsed = RegisterTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token or platform' }, { status: 400 });
  }

  const { token, platform } = parsed.data;

  const { error } = await supabase
    .from('push_device_tokens')
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    return NextResponse.json({ error: 'Failed to register device token' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
