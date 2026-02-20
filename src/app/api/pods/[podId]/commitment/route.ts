/**
 * Pod Commitment API
 * POST /api/pods/[podId]/commitment - Set this week's commitment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentWeekStart } from '@/lib/pods/progress';

interface RouteContext {
  params: Promise<{ podId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { podId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a member of this pod
    const { data: membership } = await supabase
      .from('pod_members')
      .select('id')
      .eq('pod_id', podId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this pod' }, { status: 403 });
    }

    const body = await request.json();
    const { workouts_per_week } = body;

    if (!workouts_per_week || typeof workouts_per_week !== 'number') {
      return NextResponse.json({ error: 'workouts_per_week is required' }, { status: 400 });
    }

    if (workouts_per_week < 1 || workouts_per_week > 7) {
      return NextResponse.json({ error: 'Commitment must be between 1 and 7 workouts per week' }, { status: 400 });
    }

    // Get current week start
    const weekStart = getCurrentWeekStart();
    const weekStartDate = weekStart.toISOString().split('T')[0];

    // Upsert commitment for this week
    const { error: upsertError } = await supabase
      .from('pod_commitments')
      .upsert({
        pod_id: podId,
        user_id: user.id,
        workouts_per_week,
        week_start_date: weekStartDate
      }, {
        onConflict: 'pod_id,user_id,week_start_date'
      });

    if (upsertError) {
      console.error('Commitment upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to set commitment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      commitment: {
        workouts_per_week,
        week_start_date: weekStartDate
      }
    });
  } catch (error) {
    console.error('Set commitment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
