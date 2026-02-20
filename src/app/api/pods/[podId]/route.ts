/**
 * Pod Details API
 * GET /api/pods/[podId] - Get pod details with member progress
 * DELETE /api/pods/[podId] - Delete pod (creator only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPodMemberProgress } from '@/lib/pods/progress';

interface RouteContext {
  params: Promise<{ podId: string }>;
}

/**
 * GET /api/pods/[podId]
 * Returns pod details with member progress
 */
export async function GET(
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
      return NextResponse.json({ error: 'Pod not found or access denied' }, { status: 404 });
    }

    // Get pod details
    const { data: pod, error: podError } = await supabase
      .from('accountability_pods')
      .select('*')
      .eq('id', podId)
      .single();

    if (podError || !pod) {
      return NextResponse.json({ error: 'Pod not found' }, { status: 404 });
    }

    // Get members with profiles
    const { data: members } = await supabase
      .from('pod_members')
      .select(`
        user_id,
        joined_at,
        status,
        profiles!inner(display_name, username)
      `)
      .eq('pod_id', podId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    const membersFormatted = (members || []).map(m => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        user_id: m.user_id,
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        joined_at: m.joined_at,
        status: m.status
      };
    });

    // Get member progress
    const membersProgress = await getPodMemberProgress(podId);

    // Get recent messages
    const { data: messages } = await supabase
      .from('pod_messages')
      .select(`
        id,
        sender_id,
        recipient_id,
        message,
        created_at,
        sender:profiles!pod_messages_sender_id_fkey(display_name),
        recipient:profiles!pod_messages_recipient_id_fkey(display_name)
      `)
      .eq('pod_id', podId)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentMessages = (messages || []).map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: (Array.isArray(m.sender) ? m.sender[0] : m.sender)?.display_name || null,
      recipient_id: m.recipient_id,
      recipient_name: m.recipient ? (Array.isArray(m.recipient) ? m.recipient[0] : m.recipient)?.display_name || null : null,
      message: m.message,
      created_at: m.created_at
    }));

    return NextResponse.json({
      pod: {
        ...pod,
        members: membersFormatted,
        member_count: membersFormatted.length,
        members_progress: membersProgress,
        recent_messages: recentMessages
      }
    });
  } catch (error) {
    console.error('Pod GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/pods/[podId]
 * Delete pod (creator only)
 */
export async function DELETE(
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

    // Verify user is the creator
    const { data: pod } = await supabase
      .from('accountability_pods')
      .select('creator_id')
      .eq('id', podId)
      .single();

    if (!pod || pod.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only the pod creator can delete it' }, { status: 403 });
    }

    // Delete pod (cascade will handle members, commitments, messages)
    const { error: deleteError } = await supabase
      .from('accountability_pods')
      .delete()
      .eq('id', podId);

    if (deleteError) {
      console.error('Pod deletion error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete pod' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pod DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
