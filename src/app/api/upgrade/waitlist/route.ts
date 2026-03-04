/**
 * Pro Waitlist API
 * POST /api/upgrade/waitlist – join (or re-join) the Pro waitlist
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { parsePayload } from "@/lib/validation/parse-payload";
import { waitlistJoinSchema } from "@/lib/validation/api.schemas";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { email } = parsePayload(waitlistJoinSchema, await req.json());

    const { error } = await supabase
      .from("pro_waitlist")
      .upsert(
        { user_id: user.id, email },
        { onConflict: "user_id" },
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    logger.error("POST /api/upgrade/waitlist error:", error);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
