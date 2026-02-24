import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePayload } from "@/lib/validation/parse";
import { patchRunSchema } from "@/lib/validation/run.schemas";
import { RUN_FEATURE_ENABLED } from "@/lib/features";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [runResult, splitsResult] = await Promise.all([
      supabase
        .from("run_sessions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("run_splits")
        .select("*")
        .eq("run_session_id", id)
        .eq("user_id", user.id)
        .order("split_number", { ascending: true }),
    ]);

    if (runResult.error) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({
      run: runResult.data,
      splits: splitsResult.data ?? [],
    });
  } catch (error) {
    console.error("Run detail GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const raw = await request.json();
    const parsed = parsePayload(patchRunSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { data, error } = await supabase
      .from("run_sessions")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update run" },
        { status: 500 }
      );
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("Run PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!RUN_FEATURE_ENABLED) {
    return NextResponse.json(
      { error: "Run feature is temporarily disabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Delete mirrored workout session first
    await supabase
      .from("workout_sessions")
      .delete()
      .eq("user_id", user.id)
      .like("notes", `run:${id}`);

    // Delete run session (cascades to splits)
    const { error } = await supabase
      .from("run_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete run" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Run DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
