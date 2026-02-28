import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { z } from "zod";
import { parsePayload } from "@/lib/validation/parse";
import { RUN_FEATURE_ENABLED } from "@/lib/features";

const createActiveRunSchema = z.object({
  run_session_id: z.string().uuid(),
  session_name: z.string().trim().min(1).max(120),
});

function formatDbError(error: unknown) {
  const e = error as { code?: string; message?: string; details?: string };
  const base = {
    error: "Failed to register active run",
  };
  if (process.env.NODE_ENV === "development") {
    return {
      ...base,
      db_error: e?.message ?? "Unknown database error",
      db_code: e?.code ?? null,
      db_details: e?.details ?? null,
    };
  }
  return base;
}

export async function POST(request: NextRequest) {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const raw = await request.json();
    const parsed = parsePayload(createActiveRunSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { run_session_id, session_name } = parsed.data;

    // Check for existing active session
    const { data: existing, error: existingError } = await supabase
      .from("active_workout_sessions")
      .select("user_id, run_session_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("Active run existing lookup error:", existingError);
      return NextResponse.json(
        { error: "Failed to check active session" },
        { status: 500 }
      );
    }

    if (existing) {
      const isRunActive = "run_session_id" in existing && !!existing.run_session_id;
      return NextResponse.json(
        {
          error: isRunActive
            ? "You already have an active run"
            : "You have an active workout — end it before starting a run",
          activeType: isRunActive ? "run" : "workout",
        },
        { status: 409 }
      );
    }

    const payload = {
      user_id: user.id,
      session_name,
      started_at: new Date().toISOString(),
      exercise_count: 0,
      run_session_id,
    };

    const { error } = await supabase
      .from("active_workout_sessions")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("Active run POST error:", error);
      return NextResponse.json(formatDbError(error), { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Active run POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { error } = await supabase
      .from("active_workout_sessions")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("Active run DELETE table error:", error);
      return NextResponse.json(
        { error: "Failed to clear active run" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Active run DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
