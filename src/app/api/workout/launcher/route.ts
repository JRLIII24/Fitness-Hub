/**
 * Smart Workout Launcher API
 * GET /api/workout/launcher - Get suggested workout for today
 * POST /api/workout/launcher/start - Start workout from launcher
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeLauncherWorkout, getAlternativeTemplates, logLauncherEvent } from '@/lib/adaptive/launcher';

/**
 * GET /api/workout/launcher
 * Returns suggested workout based on user patterns
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

    // Check feature flag
    const { data: profile } = await supabase
      .from('profiles')
      .select('feature_flags')
      .eq('id', user.id)
      .single();

    const featureFlags = profile?.feature_flags as Record<string, boolean> || {};
    if (!featureFlags.launcher_enabled) {
      return NextResponse.json(
        { error: 'Feature not enabled' },
        { status: 403 }
      );
    }

    // Compute launcher prediction
    const suggested_workout = await computeLauncherWorkout(user.id);
    const alternative_templates = await getAlternativeTemplates(user.id, 3);

    // Log impression
    await logLauncherEvent(user.id, 'launcher_shown', {
      confidence: suggested_workout.confidence,
      template_id: suggested_workout.template_id,
      day_of_week: new Date().getDay(),
      time_of_day: getTimeOfDay(),
      alternatives_count: alternative_templates.length
    });

    // Update last launcher used timestamp
    await supabase
      .from('profiles')
      .update({ last_launcher_used_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      suggested_workout,
      alternative_templates
    });
  } catch (error) {
    console.error('Launcher GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workout/launcher/start
 * Start workout from launcher (accepted or alternative chosen)
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
    const { template_id, accepted, time_to_decision_ms } = body;

    if (typeof accepted !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required field: accepted' },
        { status: 400 }
      );
    }

    // Log acceptance/rejection
    if (accepted) {
      await logLauncherEvent(user.id, 'launcher_accepted', {
        template_id,
        time_to_decision_ms,
        modified: false
      });
    } else {
      await logLauncherEvent(user.id, 'launcher_rejected', {
        template_id,
        chosen_alternative_id: body.chosen_alternative_id || null,
        reason: body.reason || 'picked_alternative'
      });
    }

    // Return success (actual workout start happens client-side)
    return NextResponse.json({
      success: true,
      message: accepted ? 'Launcher workout accepted' : 'Alternative chosen'
    });
  } catch (error) {
    console.error('Launcher POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Determine time of day
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
