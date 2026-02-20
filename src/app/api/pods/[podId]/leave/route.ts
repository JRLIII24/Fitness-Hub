/**
 * Pod Leave API
 * POST /api/pods/[podId]/leave - Leave a pod (update status to 'left')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Check if user is the creator
    const { data: pod } = await supabase
      .from('accountability_pods')
      .select('creator_id, name')
      .eq('id', podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: 'Pod not found' }, { status: 404 });
    }

    if (pod.creator_id === user.id) {
      return NextResponse.json({
        error: 'Pod creator cannot leave. Delete the pod instead or transfer ownership.'
      }, { status: 400 });
    }

    // Update member status to 'left'
    const { error: updateError } = await supabase
      .from('pod_members')
      .update({ status: 'left' })
      .eq('pod_id', podId)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateError) {
      console.error('Leave pod error:', updateError);
      return NextResponse.json({ error: 'Failed to leave pod' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `You left ${pod.name}`
    });
  } catch (error) {
    console.error('Leave pod error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
