/**
 * Pods API
 * GET /api/pods - List user's pods
 * POST /api/pods - Create new pod
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { parsePayload } from "@/lib/validation/parse";
import { createPodSchema } from "@/lib/validation/pods.schemas";
import { logger } from "@/lib/logger";

/**
 * GET /api/pods
 * Returns all pods the user is a member of
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Get pod IDs where user is an active member
    const { data: membershipData, error: membershipError } = await supabase
      .from('pod_members')
      .select('pod_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      logger.error('Membership fetch error:', membershipError);
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
      logger.error('Pods fetch error:', podsError);
      return NextResponse.json({
        error: 'Failed to fetch pods',
        details: podsError.message
      }, { status: 500 });
    }

    // Batch-fetch all active members for these pods in one query (replaces N per-pod queries).
    const { data: allMembers } = await supabase
      .from('pod_members')
      .select('pod_id, user_id, joined_at, status, profiles!inner(display_name, username)')
      .in('pod_id', podIds)
      .eq('status', 'active');

    // Group members by pod_id in JS
    const membersByPodId = new Map<string, NonNullable<typeof allMembers>>();
    for (const m of (allMembers || [])) {
      const list = membersByPodId.get(m.pod_id) ?? [];
      list.push(m);
      membersByPodId.set(m.pod_id, list);
    }

    const pods = (podsData || []).map((pod) => {
      const members = membersByPodId.get(pod.id) ?? [];
      return {
        ...pod,
        member_count: members.length,
        members: members.map(m => {
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
    });

    return NextResponse.json({ pods });
  } catch (error) {
    logger.error('Pods GET error:', error);
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
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Rate limit: 5 pod creations per user per minute
    if (!(await rateLimit(`pods:${user.id}`, 5, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = parsePayload(createPodSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
    }
    const { name, description } = parsed.data;

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
      logger.error('Pod creation error:', createError);
      return NextResponse.json({ error: 'Failed to create pod' }, { status: 500 });
    }

    return NextResponse.json({ pod }, { status: 201 });
  } catch (error) {
    logger.error('Pods POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
