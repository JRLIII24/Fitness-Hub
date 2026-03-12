/**
 * POST /api/workout/[id]/summarize
 *
 * Generates an AI "Coach's Note" for a completed workout session.
 * Triggered fire-and-forget after the user submits session RPE.
 * Idempotent — skips if a summary already exists for this session.
 */

import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { SESSION_SUMMARY_SYSTEM_PROMPT } from "@/lib/ai-prompts/session-summary";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json(
        { error: "AI not configured" },
        { status: 503 },
      );
    }

    // Verify session belongs to user and is completed
    const { data: session } = await supabase
      .from("workout_sessions")
      .select(
        "id, name, duration_seconds, session_rpe, total_volume_kg, started_at, completed_at",
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .single();

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or not completed" },
        { status: 404 },
      );
    }

    // Idempotency: skip if summary already exists
    const { data: existing } = await supabase
      .from("session_summaries")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: "already_exists" });
    }

    // Fetch all sets with exercise details
    const { data: sets } = await supabase
      .from("workout_sets")
      .select(
        "set_number, set_type, weight_kg, reps, rpe, rir, completed_at, exercises!inner(name, muscle_group)",
      )
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true });

    // Fetch last 3 session summaries for trend context
    const { data: priorSummaries } = await supabase
      .from("session_summaries")
      .select("summary, key_observations, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    // Build the session data for the prompt
    type SetRow = {
      set_number: number;
      set_type: string;
      weight_kg: number | null;
      reps: number | null;
      rpe: number | null;
      rir: number | null;
      completed_at: string | null;
      exercises:
        | { name: string; muscle_group: string }
        | { name: string; muscle_group: string }[];
    };

    const exerciseMap = new Map<
      string,
      Array<{
        set_number: number;
        set_type: string;
        weight_kg: number | null;
        reps: number | null;
        rpe: number | null;
      }>
    >();

    for (const row of (sets ?? []) as SetRow[]) {
      const ex = Array.isArray(row.exercises)
        ? row.exercises[0]
        : row.exercises;
      if (!ex) continue;
      const key = `${ex.name} (${ex.muscle_group})`;
      const list = exerciseMap.get(key) ?? [];
      list.push({
        set_number: row.set_number,
        set_type: row.set_type,
        weight_kg: row.weight_kg,
        reps: row.reps,
        rpe: row.rpe,
      });
      exerciseMap.set(key, list);
    }

    const exerciseData = Object.fromEntries(exerciseMap);

    const durationMin = session.duration_seconds
      ? Math.round(session.duration_seconds / 60)
      : null;

    const sessionData = {
      name: session.name,
      date: session.completed_at ?? session.started_at,
      duration_minutes: durationMin,
      session_rpe: session.session_rpe,
      total_volume_kg: session.total_volume_kg,
      exercises: exerciseData,
    };

    const priorContext =
      priorSummaries && priorSummaries.length > 0
        ? priorSummaries.map((s, i) => `--- Previous session ${i + 1} (${s.created_at}) ---\n${s.summary}`).join("\n\n")
        : "No previous session notes available.";

    const userMessage = `## Current Session Data
${JSON.stringify(sessionData, null, 2)}

## Previous Session Notes
${priorContext}`;

    const { text } = await generateText({
      model: provider(HAIKU),
      system: SESSION_SUMMARY_SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: 1024,
    });

    // Parse the AI response
    let summary: string;
    let keyObservations: Record<string, unknown> | null = null; // cast to Json below

    try {
      const parsed = JSON.parse(text);
      summary = parsed.summary ?? text;
      keyObservations = parsed.key_observations ?? null;
    } catch {
      // If JSON parse fails, use raw text as summary
      summary = text;
    }

    // Insert summary
    const { error: insertErr } = await supabase
      .from("session_summaries")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        summary,
        key_observations: keyObservations as unknown as import("@/types/database").Json,
      });

    if (insertErr) {
      // UNIQUE constraint violation means another request beat us — that's fine
      if (insertErr.code === "23505") {
        return NextResponse.json({ status: "already_exists" });
      }
      logger.error("Failed to insert session summary:", insertErr);
      return NextResponse.json(
        { error: "Failed to save summary" },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: "created" });
  } catch (error) {
    logger.error("Session summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 },
    );
  }
}
