/**
 * Pod Invites API
 * GET /api/pods/invites - Get user's pending pod invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending invitations
    const { data: invites, error: invitesError } = await supabase
      .from('pod_invites')
      .select(`
        id,
        pod_id,
        created_at,
        accountability_pods(name),
        profiles!pod_invites_inviter_id_fkey(display_name, username)
      `)
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invitesError) {
      console.error('Invites fetch error:', invitesError);
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
    }

    const formattedInvites = (invites || []).map((inv) => {
      const pod = Array.isArray(inv.accountability_pods)
        ? inv.accountability_pods[0]
        : inv.accountability_pods;
      const inviter = Array.isArray(inv.profiles)
        ? inv.profiles[0]
        : inv.profiles;

      return {
        id: inv.id,
        pod_id: inv.pod_id,
        pod_name: pod?.name || 'Unknown Pod',
        inviter_name: inviter?.display_name || inviter?.username || null,
        created_at: inv.created_at,
      };
    });

    return NextResponse.json({ invites: formattedInvites });
  } catch (error) {
    console.error('Invites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
