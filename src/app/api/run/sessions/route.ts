import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePayload } from "@/lib/validation/parse";
import { saveRunSchema } from "@/lib/validation/run.schemas";
import { computeRunSessionLoad } from "@/lib/run/fatigue-integration";
import type { RunIntensityZone } from "@/types/run";
import { RUN_FEATURE_ENABLED } from "@/lib/features";

async function insertMirrorWorkoutSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    user_id: string;
    name: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    session_rpe: number;
    run_session_id: string;
  }
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await supabase.from("workout_sessions").insert({
      user_id: payload.user_id,
      name: payload.name,
      status: "completed" as const,
      started_at: payload.started_at,
      completed_at: payload.completed_at,
      duration_seconds: payload.duration_seconds,
      session_rpe: payload.session_rpe,
      notes: `run:${payload.run_session_id}`,
      total_volume_kg: 0,
    });

    if (!error) return { success: true as const };
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 200));
  }

  return { success: false as const, error: lastError };
}

export async function GET(request: NextRequest) {
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

    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") ?? "20",
      10
    );
    const offset = parseInt(
      request.nextUrl.searchParams.get("offset") ?? "0",
      10
    );

    const { data, error } = await supabase
      .from("run_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Run sessions GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch runs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs: data ?? [] });
  } catch (error) {
    console.error("Run sessions GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = parsePayload(saveRunSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const d = parsed.data;

    // Compute session load with zone multiplier
    const sessionLoad =
      d.session_rpe != null && d.duration_seconds > 0
        ? computeRunSessionLoad(
            d.session_rpe,
            d.duration_seconds,
            d.primary_zone as RunIntensityZone | null
          )
        : null;

    // 1. Insert run session
    const { data: runSession, error: runError } = await supabase
      .from("run_sessions")
      .insert({
        id: d.local_id,
        user_id: user.id,
        name: d.name,
        status: "completed" as const,
        tag: d.tag,
        notes: d.notes ?? null,
        started_at: d.started_at,
        completed_at: d.completed_at,
        duration_seconds: d.duration_seconds,
        moving_duration_seconds: d.moving_duration_seconds,
        distance_meters: d.distance_meters,
        avg_pace_sec_per_km: d.avg_pace_sec_per_km,
        best_pace_sec_per_km: d.best_pace_sec_per_km,
        elevation_gain_m: d.elevation_gain_m,
        elevation_loss_m: d.elevation_loss_m,
        avg_cadence_spm: d.avg_cadence_spm ?? null,
        estimated_calories: d.estimated_calories,
        session_rpe: d.session_rpe,
        estimated_vo2max: d.estimated_vo2max,
        session_load: sessionLoad,
        zone_breakdown: d.zone_breakdown,
        primary_zone: d.primary_zone,
        route_polyline: d.route_polyline,
        is_treadmill: d.is_treadmill,
        map_bbox: d.map_bbox,
      })
      .select()
      .single();

    if (runError) {
      console.error("Run session insert error:", runError);
      return NextResponse.json(
        { error: "Failed to save run" },
        { status: 500 }
      );
    }

    // 2. Insert splits
    if (d.splits.length > 0) {
      const splitsToInsert = d.splits.map((s) => ({
        run_session_id: runSession.id,
        user_id: user.id,
        split_number: s.split_number,
        split_distance_meters: s.split_distance_meters,
        duration_seconds: s.duration_seconds,
        pace_sec_per_km: s.pace_sec_per_km,
        elevation_gain_m: s.elevation_gain_m,
        elevation_loss_m: s.elevation_loss_m,
        zone: s.zone,
        lat: s.lat,
        lng: s.lng,
        started_at: s.started_at,
        completed_at: s.completed_at,
      }));

      const { error: splitsError } = await supabase
        .from("run_splits")
        .insert(splitsToInsert);

      if (splitsError) {
        console.error("Run splits insert error:", splitsError);
      }
    }

    // 3. Mirror into workout_sessions for fatigue integration.
    // Keep active session intact if mirroring is not confirmed.
    let mirrorConfirmed = true;
    if (d.session_rpe != null) {
      const mirrorResult = await insertMirrorWorkoutSession(supabase, {
        user_id: user.id,
        name: d.name,
        started_at: d.started_at,
        completed_at: d.completed_at,
        duration_seconds: d.duration_seconds,
        session_rpe: d.session_rpe,
        run_session_id: runSession.id,
      });

      if (!mirrorResult.success) {
        mirrorConfirmed = false;
        console.error(
          "CRITICAL: mirrored workout session insert failed after retries:",
          mirrorResult.error
        );
      }
    }

    // 4. Clear active session only after mirror confirmation.
    if (mirrorConfirmed) {
      await supabase
        .from("active_workout_sessions")
        .delete()
        .eq("user_id", user.id);
    }

    return NextResponse.json(
      {
        run: runSession,
        mirror_confirmed: mirrorConfirmed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Run sessions POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
