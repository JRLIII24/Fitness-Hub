import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const PreferencesSchema = z.object({
  streak_alerts_enabled: z.boolean().optional(),
  pod_pings_enabled: z.boolean().optional(),
  workout_reminders_enabled: z.boolean().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
  quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Return defaults if no record exists
  const prefs = data ?? {
    streak_alerts_enabled: true,
    pod_pings_enabled: true,
    workout_reminders_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
  };

  return NextResponse.json(prefs);
}

export async function PUT(request: Request) {
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

  const parsed = PreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preferences' },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.streak_alerts_enabled !== undefined) updates.streak_alerts_enabled = body.streak_alerts_enabled;
  if (body.pod_pings_enabled !== undefined) updates.pod_pings_enabled = body.pod_pings_enabled;
  if (body.workout_reminders_enabled !== undefined) updates.workout_reminders_enabled = body.workout_reminders_enabled;
  if (body.quiet_hours_start !== undefined) updates.quiet_hours_start = body.quiet_hours_start;
  if (body.quiet_hours_end !== undefined) updates.quiet_hours_end = body.quiet_hours_end;

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, ...updates },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }

  return NextResponse.json(data);
}
