/**
 * Pod Commitment API
 * POST /api/pods/[podId]/commitment - Set this week's commitment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentWeekStart } from '@/lib/pods/progress';
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ podId: string }>;
}

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { podId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

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
    const { workouts_per_week, planned_days } = body;

    if (!workouts_per_week || typeof workouts_per_week !== 'number') {
      return NextResponse.json({ error: 'workouts_per_week is required' }, { status: 400 });
    }

    if (workouts_per_week < 1 || workouts_per_week > 7) {
      return NextResponse.json({ error: 'Commitment must be between 1 and 7 workouts per week' }, { status: 400 });
    }

    // Validate planned_days if provided
    const days: string[] = Array.isArray(planned_days)
      ? planned_days.filter((d: unknown) => typeof d === 'string' && VALID_DAYS.includes(d as string))
      : [];

    // Get current week start (timezone-aware — fetch user's tz)
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle();
    const weekStartDate = getCurrentWeekStart(profile?.timezone || 'UTC');

    // Upsert commitment for this week
    // Try with planned_days first; fall back without it if column doesn't exist yet
    const upsertPayload: Record<string, unknown> = {
      pod_id: podId,
      user_id: user.id,
      workouts_per_week: workouts_per_week,
      week_start_date: weekStartDate,
    };
    if (days.length > 0) {
      upsertPayload.planned_days = days;
    }

    let { error: upsertError } = await supabase
      .from('pod_commitments')
      .upsert(upsertPayload as any, {
        onConflict: 'pod_id,user_id,week_start_date'
      });

    // If planned_days column doesn't exist yet, retry without it
    if (upsertError?.message?.includes('planned_days')) {
      delete upsertPayload.planned_days;
      const retry = await supabase
        .from('pod_commitments')
        .upsert(upsertPayload as any, {
          onConflict: 'pod_id,user_id,week_start_date'
        });
      upsertError = retry.error;
    }

    if (upsertError) {
      logger.error('Commitment upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to set commitment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      commitment: {
        workouts_per_week,
        planned_days: days,
        week_start_date: weekStartDate
      }
    });
  } catch (error) {
    logger.error('Set commitment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
