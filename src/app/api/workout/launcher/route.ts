/**
 * Smart Workout Launcher API
 * GET /api/workout/launcher - Get suggested workout for today
 * POST /api/workout/launcher/start - Start workout from launcher
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { computeLauncherWorkout, getAlternativeTemplates, logLauncherEvent, enrichWithAI } from '@/lib/adaptive/launcher';
import { logger } from '@/lib/logger';

/**
 * GET /api/workout/launcher
 * Returns suggested workout based on user patterns
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

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

    // Compute launcher prediction, then enrich with AI asynchronously
    const base_prediction = await computeLauncherWorkout(user.id);
    const origin = new URL(request.url).origin;
    const [suggested_workout, alternative_templates] = await Promise.all([
      enrichWithAI(base_prediction, origin),
      getAlternativeTemplates(user.id, 3),
    ]);

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
    logger.error('Launcher GET error:', error);
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
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const bodyText = await request.text();
    let rawBody;
    try {
      rawBody = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { parsePayload } = await import('@/lib/validation/parse');
    const { launcherStartSchema } = await import('@/lib/validation/workout.schemas');

    const parseResult = parsePayload(launcherStartSchema, rawBody);
    if (!parseResult.success) {
      return NextResponse.json(parseResult.error, { status: 400 });
    }

    const body = parseResult.data;
    const { template_id, accepted, time_to_decision_ms } = body;

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
    logger.error('Launcher POST error:', error);
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
