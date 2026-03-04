import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const body = await request.json();
  const {
    streak_alerts_enabled,
    pod_pings_enabled,
    workout_reminders_enabled,
    quiet_hours_start,
    quiet_hours_end,
  } = body as {
    streak_alerts_enabled?: boolean;
    pod_pings_enabled?: boolean;
    workout_reminders_enabled?: boolean;
    quiet_hours_start?: number | null;
    quiet_hours_end?: number | null;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (streak_alerts_enabled !== undefined) updates.streak_alerts_enabled = streak_alerts_enabled;
  if (pod_pings_enabled !== undefined) updates.pod_pings_enabled = pod_pings_enabled;
  if (workout_reminders_enabled !== undefined) updates.workout_reminders_enabled = workout_reminders_enabled;
  if (quiet_hours_start !== undefined) updates.quiet_hours_start = quiet_hours_start;
  if (quiet_hours_end !== undefined) updates.quiet_hours_end = quiet_hours_end;

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, ...updates },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
