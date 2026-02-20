/**
 * Pod Invite Response API
 * POST /api/pods/invites/[inviteId] - Accept or decline a pod invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { inviteId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body; // 'accept' or 'decline'

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('pod_invites')
      .select('id, pod_id, invitee_id, status, accountability_pods(name)')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify user is the invitee
    if (invite.invitee_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to respond to this invitation' }, { status: 403 });
    }

    // Check if already responded
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already responded to' }, { status: 400 });
    }

    // Update invite status (trigger will handle adding to pod_members if accepted)
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const { error: updateError } = await supabase
      .from('pod_invites')
      .update({ status: newStatus })
      .eq('id', inviteId);

    if (updateError) {
      console.error('Invite response error:', updateError);
      return NextResponse.json({ error: 'Failed to respond to invitation' }, { status: 500 });
    }

    const podRelation = invite.accountability_pods as
      | { name?: string | null }
      | Array<{ name?: string | null }>
      | null;
    const podName = Array.isArray(podRelation)
      ? podRelation[0]?.name
      : podRelation?.name;

    return NextResponse.json({
      success: true,
      message: action === 'accept'
        ? `You joined ${podName || 'the pod'}!`
        : 'Invitation declined'
    });
  } catch (error) {
    console.error('Invite response error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
