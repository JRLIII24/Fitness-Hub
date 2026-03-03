import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { z } from "zod";
import { parsePayload } from "@/lib/validation/parse";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import { logger } from "@/lib/logger";

const createChallengeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  challenge_type: z.enum(["volume", "consistency"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  target_value: z.number().positive().nullable().optional(),
}).refine((d) => d.end_date >= d.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

/** GET /api/pods/[podId]/challenges — list challenges for the pod */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ podId: string }> }
) {
  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ error: "Pod challenges are disabled" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { podId } = await params;

    // Verify caller is an active pod member (RLS also enforces this)
    const { data: membership } = await supabase
      .from("pod_members")
      .select("user_id")
      .eq("pod_id", podId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this pod" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("pod_challenges")
      .select("*")
      .eq("pod_id", podId)
      .order("start_date", { ascending: false });

    if (error) {
      logger.error("Pod challenges GET error:", error);
      return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const challenges = (data ?? []).map((c) => ({
      ...c,
      is_active: c.start_date <= today && c.end_date >= today,
    }));

    return NextResponse.json({ challenges });
  } catch (error) {
    logger.error("Pod challenges GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/pods/[podId]/challenges — create a challenge */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ podId: string }> }
) {
  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ error: "Pod challenges are disabled" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { podId } = await params;

    const raw = await request.json();
    const parsed = parsePayload(createChallengeSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { name, challenge_type, start_date, end_date, target_value } = parsed.data;

    const { data, error } = await supabase
      .from("pod_challenges")
      .insert({
        pod_id: podId,
        name,
        challenge_type,
        start_date,
        end_date,
        target_value: target_value ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // RLS violation — user is not an active pod member
      if (error.code === "42501") {
        return NextResponse.json({ error: "Not a member of this pod" }, { status: 403 });
      }
      logger.error("Pod challenge create error:", error);
      return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 });
    }

    return NextResponse.json({ challenge: data }, { status: 201 });
  } catch (error) {
    logger.error("Pod challenge create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
