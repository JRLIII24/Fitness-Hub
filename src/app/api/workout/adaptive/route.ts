/**
 * Adaptive Workout API
 * GET /api/workout/adaptive - Get fatigue-adapted workout recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAdaptiveWorkout } from '@/lib/adaptive/workout-generator';
import { analyzeFatigue } from '@/lib/adaptive/fatigue';

/**
 * GET /api/workout/adaptive
 * Returns adaptive workout based on current fatigue analysis
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate adaptive workout
    const adaptiveWorkout = await generateAdaptiveWorkout(user.id);

    // Log analytics event
    await supabase.from('workout_events').insert({
      user_id: user.id,
      event_type: 'workout_launched',
      event_data: {
        action: 'adaptive_shown',
        adaptation_type: adaptiveWorkout.adaptationType,
        fatigue_score: adaptiveWorkout.fatigueScore,
        volume_adjustment: adaptiveWorkout.volumeAdjustment,
        template_id: adaptiveWorkout.template_id,
        day_of_week: new Date().getDay()
      }
    });

    return NextResponse.json(adaptiveWorkout);
  } catch (error) {
    console.error('Adaptive workout GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workout/adaptive/start
 * Log when user starts an adaptive workout
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accepted, template_id, adaptation_type } = body;

    if (typeof accepted !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required field: accepted' },
        { status: 400 }
      );
    }

    // Log acceptance/rejection
    if (accepted) {
      await supabase.from('workout_events').insert({
        user_id: user.id,
        event_type: 'workout_launched',
        event_data: {
          action: 'adaptive_accepted',
          adaptation_type,
          template_id
        }
      });
    } else {
      await supabase.from('workout_events').insert({
        user_id: user.id,
        event_type: 'workout_launched',
        event_data: {
          action: 'adaptive_rejected',
          adaptation_type,
          reason: body.reason || 'user_chose_different'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: accepted ? 'Adaptive workout accepted' : 'Adaptive workout rejected'
    });
  } catch (error) {
    console.error('Adaptive workout POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
