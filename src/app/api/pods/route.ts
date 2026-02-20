/**
 * Pods API
 * GET /api/pods - List user's pods
 * POST /api/pods - Create new pod
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/pods
 * Returns all pods the user is a member of
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pod IDs where user is an active member
    const { data: membershipData, error: membershipError } = await supabase
      .from('pod_members')
      .select('pod_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      console.error('Membership fetch error:', membershipError);
      return NextResponse.json({
        error: 'Failed to fetch memberships',
        details: membershipError.message
      }, { status: 500 });
    }

    // If user has no pods, return empty array
    if (!membershipData || membershipData.length === 0) {
      return NextResponse.json({ pods: [] });
    }

    const podIds = membershipData.map(m => m.pod_id);

    // Get pod details
    const { data: podsData, error: podsError } = await supabase
      .from('accountability_pods')
      .select('id, name, description, creator_id, created_at, updated_at')
      .in('id', podIds);

    if (podsError) {
      console.error('Pods fetch error:', podsError);
      return NextResponse.json({
        error: 'Failed to fetch pods',
        details: podsError.message
      }, { status: 500 });
    }

    // Get member counts and members for each pod
    const pods = await Promise.all(
      (podsData || []).map(async (pod) => {
        const { data: members, count } = await supabase
          .from('pod_members')
          .select('user_id, joined_at, status, profiles!inner(display_name, username)', { count: 'exact' })
          .eq('pod_id', pod.id)
          .eq('status', 'active');

        return {
          ...pod,
          member_count: count || 0,
          members: (members || []).map(m => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              user_id: m.user_id,
              display_name: profile?.display_name || null,
              username: profile?.username || null,
              joined_at: m.joined_at,
              status: m.status
            };
          })
        };
      })
    );

    return NextResponse.json({ pods });
  } catch (error) {
    console.error('Pods GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/pods
 * Create a new pod
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return NextResponse.json(
        { error: 'Pod name must be between 2-50 characters' },
        { status: 400 }
      );
    }

    if (description && (typeof description !== 'string' || description.length > 200)) {
      return NextResponse.json(
        { error: 'Description must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Create pod
    const { data: pod, error: createError } = await supabase
      .from('accountability_pods')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        creator_id: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Pod creation error:', createError);
      return NextResponse.json({ error: 'Failed to create pod' }, { status: 500 });
    }

    return NextResponse.json({ pod }, { status: 201 });
  } catch (error) {
    console.error('Pods POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
