/**
 * Pod Messages API
 * POST /api/pods/[podId]/messages - Send encouragement message
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
    const { message, recipient_id } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.trim().length < 1 || message.trim().length > 280) {
      return NextResponse.json({ error: 'Message must be 1-280 characters' }, { status: 400 });
    }

    // If recipient_id is provided, verify they're in the pod
    if (recipient_id) {
      const { data: recipientMember } = await supabase
        .from('pod_members')
        .select('id')
        .eq('pod_id', podId)
        .eq('user_id', recipient_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!recipientMember) {
        return NextResponse.json({ error: 'Recipient is not a member of this pod' }, { status: 400 });
      }
    }

    // Insert message
    const { data: newMessage, error: insertError } = await supabase
      .from('pod_messages')
      .insert({
        pod_id: podId,
        sender_id: user.id,
        recipient_id: recipient_id || null,
        message: message.trim()
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Message insert error:', insertError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: {
        id: newMessage.id,
        created_at: newMessage.created_at
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
