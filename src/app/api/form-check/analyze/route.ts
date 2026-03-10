/**
 * Form Check Analysis API
 * POST /api/form-check/analyze
 *
 * Accepts extracted video frames + exercise context, runs Haiku vision analysis,
 * and persists structured form report.
 *
 * Model: Sonnet (vision — complex form analysis)
 * Runtime: nodejs (multi-frame payloads can exceed edge limits)
 * Timeout: 45s (overrides default 25s)
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, SONNET } from "@/lib/ai-sdk";
import { buildFormAnalysisPrompt, buildFrameAnalysisUserMessage } from "@/lib/ai-prompts/form-analysis";
import {
  AnalyzeRequestSchema,
  FormAnalysisToolSchema,
} from "@/lib/form-analysis/contracts";

const MAX_TOTAL_FRAME_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await request.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { videoId, selectedExercise, durationSeconds, frames } = parsed.data;

    // Validate total frame payload size
    let totalBytes = 0;
    for (const f of frames) {
      totalBytes += (f.base64.length * 3) / 4;
    }
    if (totalBytes > MAX_TOTAL_FRAME_BYTES) {
      return NextResponse.json(
        { error: "Total frame payload exceeds 4MB limit" },
        { status: 400 },
      );
    }

    // Verify video ownership
    const { data: video, error: videoErr } = await supabase
      .from("form_videos")
      .select("id, analysis_status")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (videoErr || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Mark video as processing
    await supabase
      .from("form_videos")
      .update({ analysis_status: "processing", analysis_error: null })
      .eq("id", videoId);

    // Build vision messages with multi-frame content
    // AI SDK requires Buffer + mimeType, not data: URLs
    const imageBlocks = frames.map((f) => ({
      type: "image" as const,
      image: Buffer.from(f.base64, "base64"),
      mimeType: f.mediaType as "image/jpeg" | "image/png" | "image/webp",
    }));

    const textBlock = {
      type: "text" as const,
      text: buildFrameAnalysisUserMessage(
        selectedExercise,
        frames.length,
        durationSeconds,
        frames.map((f) => f.timestampSeconds),
      ),
    };

    const systemPrompt = buildFormAnalysisPrompt(selectedExercise);

    const { object: analysis } = await generateObject({
      model: provider(SONNET),
      schema: FormAnalysisToolSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, textBlock],
        },
      ],
      maxOutputTokens: 2048,
    });

    // If the user selected an exercise, force it — never let the AI override
    if (selectedExercise) {
      analysis.exercise_detected = selectedExercise;
      analysis.exercise_confidence = "high";
    }

    // Persist report
    const { data: report, error: reportErr } = await supabase
      .from("form_analysis_reports")
      .insert({
        video_id: videoId,
        user_id: user.id,
        selected_exercise: selectedExercise,
        detected_exercise: analysis.exercise_detected,
        exercise_confidence: analysis.exercise_confidence,
        overall_score: analysis.overall_score,
        summary: analysis.summary,
        praise: analysis.praise,
        recommendations: analysis.recommendations,
        safety_notes: analysis.safety_notes,
        model: SONNET,
        raw_response: JSON.parse(JSON.stringify(analysis)),
      })
      .select("id")
      .single();

    if (reportErr || !report) {
      logger.error("Failed to persist form report:", reportErr);
      await supabase
        .from("form_videos")
        .update({ analysis_status: "failed", analysis_error: "Failed to save report" })
        .eq("id", videoId);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    // Persist issues
    if (analysis.issues.length > 0) {
      const issueRows = analysis.issues.map((issue, idx) => ({
        report_id: report.id,
        user_id: user.id,
        sort_order: idx,
        body_part: issue.body_part,
        issue_type: issue.issue_type ?? null,
        severity: issue.severity,
        timestamp_seconds: issue.timestamp_seconds ?? null,
        description: issue.description,
        correction: issue.correction,
        cue: issue.cue ?? null,
        confidence: issue.confidence ?? null,
      }));

      await supabase.from("form_analysis_issues").insert(issueRows);
    }

    // Mark video as completed
    await supabase
      .from("form_videos")
      .update({ analysis_status: "completed" })
      .eq("id", videoId);

    return NextResponse.json({
      reportId: report.id,
      overallScore: analysis.overall_score,
      summary: analysis.summary,
      detectedExercise: analysis.exercise_detected,
      exerciseConfidence: analysis.exercise_confidence,
      issues: analysis.issues,
      praise: analysis.praise,
      recommendations: analysis.recommendations,
      safetyNotes: analysis.safety_notes,
    });
  } catch (error) {
    logger.error("Form check analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze form" },
      { status: 500 },
    );
  }
}
