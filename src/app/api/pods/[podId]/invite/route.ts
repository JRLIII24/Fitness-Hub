/**
 * Pod Invite API
 * POST /api/pods/[podId]/invite - Invite member by username
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findUserByUsername } from '@/lib/pods/progress';

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

    // Verify user is the pod creator
    const { data: pod } = await supabase
      .from('accountability_pods')
      .select('creator_id, name')
      .eq('id', podId)
      .single();

    if (!pod || pod.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only pod creator can invite members' }, { status: 403 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Find user by username
    const invitee = await findUserByUsername(username.trim());
    if (!invitee) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('pod_members')
      .select('id, status')
      .eq('pod_id', podId)
      .eq('user_id', invitee.id)
      .maybeSingle();

    if (existingMember && existingMember.status === 'active') {
      return NextResponse.json({ error: 'User is already a member of this pod' }, { status: 400 });
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from('pod_invites')
      .select('id, status')
      .eq('pod_id', podId)
      .eq('invitee_id', invitee.id)
      .maybeSingle();

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json({ error: 'Invitation already pending' }, { status: 400 });
      }
      // Delete old declined/accepted invite to allow re-inviting
      await supabase
        .from('pod_invites')
        .delete()
        .eq('id', existingInvite.id);
    }

    // Check pod size limit (max 8 members)
    const { count } = await supabase
      .from('pod_members')
      .select('*', { count: 'exact', head: true })
      .eq('pod_id', podId)
      .eq('status', 'active');

    if (count && count >= 8) {
      return NextResponse.json({ error: 'Pod is full (max 8 members)' }, { status: 400 });
    }

    // Create invitation
    const { error: insertError } = await supabase
      .from('pod_invites')
      .insert({
        pod_id: podId,
        inviter_id: user.id,
        invitee_id: invitee.id,
        status: 'pending'
      });

    if (insertError) {
      console.error('Invite creation error:', insertError);
      return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${invitee.display_name || invitee.username}`
    }, { status: 201 });
  } catch (error) {
    console.error('Pod invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
