/**
 * GET  /api/templates/[id]/reviews   – fetch all reviews for a template
 * POST /api/templates/[id]/reviews   – create or update reviewer's review
 * DELETE /api/templates/[id]/reviews – delete reviewer's own review
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { isValidUUID } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { parsePayload } from "@/lib/validation/parse";
import { submitReviewSchema } from "@/lib/validation/reviews.schemas";
import type { TemplateReview } from '@/types/pods';

type RawReview = {
  id: string;
  template_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { user } = await requireAuth(supabase);

  // Fetch all reviews, ordered by most recent
  const { data: reviews, error } = await supabase
    .from('template_reviews')
    .select(
      `
      id, template_id, reviewer_id, rating, comment, created_at
      `,
    )
    .eq('template_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[/api/templates/[id]/reviews GET] query error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  // Fetch reviewer profile info separately to ensure we get display_name and avatar_url.
  // This avoids relying on FK hints that may not be properly configured.
  const reviewerIds = (reviews ?? []).map(r => r.reviewer_id);
  let reviewerProfiles: Map<string, { display_name: string | null; avatar_url: string | null }> = new Map();

  if (reviewerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', reviewerIds);

    if (profiles) {
      profiles.forEach((p: { id: string; display_name: string | null; avatar_url: string | null }) => {
        reviewerProfiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
      });
    }
  }

  // Flag reviews that belong to the current user
  const result: TemplateReview[] = (reviews ?? []).map((r: RawReview) => ({
    id: r.id,
    template_id: r.template_id,
    reviewer_id: r.reviewer_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer: reviewerProfiles.get(r.reviewer_id) ?? { display_name: null, avatar_url: null },
    is_own: user ? r.reviewer_id === user.id : false,
  }));

  return NextResponse.json(
    { reviews: result },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  // Rate limit: 10 reviews per user per minute
  if (!rateLimit(`reviews:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Parse request body
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parsePayload(submitReviewSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error }, { status: 400 });
  }
  const { rating, comment } = parsed.data;

  // Guard: users cannot review their own templates
  const { data: tmpl, error: tmplErr } = await supabase
    .from('workout_templates')
    .select('user_id')
    .eq('id', id)
    .single();

  if (tmplErr) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (tmpl?.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot review your own template' }, { status: 403 });
  }

  // Upsert the review (insert or update) using onConflict with the unique constraint columns.
  // Include updated_at to ensure the timestamp updates on both insert and update.
  // (The 'default now()' only applies to INSERT without an explicit trigger for UPDATE)
  const { data: review, error: upsertErr } = await supabase
    .from('template_reviews')
    .upsert(
      {
        template_id: id,
        reviewer_id: user.id,
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'template_id,reviewer_id' },
    )
    .select(
      `
      id, template_id, reviewer_id, rating, comment, created_at
      `,
    )
    .single();

  if (upsertErr) {
    console.error('[/api/templates/[id]/reviews POST] upsert error:', upsertErr);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }

  // Fetch reviewer profile separately to ensure we have display_name and avatar_url
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single();

  const result: TemplateReview = {
    id: review.id,
    template_id: review.template_id,
    reviewer_id: review.reviewer_id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at,
    reviewer: {
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    is_own: true,
  };

  return NextResponse.json({ review: result }, { status: 201 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  // Delete the review (RLS will enforce ownership)
  const { error } = await supabase
    .from('template_reviews')
    .delete()
    .eq('template_id', id)
    .eq('reviewer_id', user.id);

  if (error) {
    console.error('[/api/templates/[id]/reviews DELETE] error:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
