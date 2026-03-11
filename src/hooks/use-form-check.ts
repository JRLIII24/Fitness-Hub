"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractFrames } from "@/lib/form-analysis/frame-extractor";
import type {
  FormVideo,
  FormHistoryItem,
  FormAnalysisResult,
  AnalysisStatus,
} from "@/lib/form-analysis/types";

const BUCKET = "form-videos";
const SIGNED_URL_TTL = 300; // 5 minutes
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes max for upload

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

interface AnalyzeResult {
  reportId: string;
  overallScore: number;
  summary: string;
  detectedExercise: string | null;
  exerciseConfidence: string;
  issues: FormAnalysisResult["issues"];
  praise: string[];
  recommendations: string[];
  safetyNotes: string[];
}

interface UseFormCheckReturn {
  /** Upload a video file → create DB row + store in private bucket */
  upload: (file: File) => Promise<{ videoId: string; storagePath: string } | null>;
  /** Run AI analysis on an uploaded video */
  analyze: (
    videoId: string,
    selectedExercise: string | null,
  ) => Promise<AnalyzeResult | null>;
  /** Delete a video and its associated report */
  deleteVideo: (videoId: string, storagePath: string) => Promise<void>;
  /** Retry analysis on a failed video */
  retry: (
    videoId: string,
    selectedExercise: string | null,
  ) => Promise<AnalyzeResult | null>;
  /** Load history of completed analyses */
  loadHistory: () => Promise<void>;
  /** Load full report with issues for a history item */
  loadFullReport: (reportId: string) => Promise<AnalyzeResult | null>;
  /** Get a short-lived signed URL for video playback */
  getSignedUrl: (storagePath: string) => Promise<string | null>;
  history: FormHistoryItem[];
  uploading: boolean;
  analyzing: boolean;
  loadingHistory: boolean;
  error: string | null;
  /** Rate limit reached (429 from analyze) */
  limitReached: boolean;
}

export function useFormCheck(userId: string | null): UseFormCheckReturn {
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<FormHistoryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // ── Upload ──
  const upload = useCallback(
    async (file: File): Promise<{ videoId: string; storagePath: string } | null> => {
      if (!userId) return null;
      setError(null);
      setUploading(true);

      try {
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error("Unsupported video format. Use MP4, MOV, or WebM.");
        }
        if (file.size > MAX_VIDEO_SIZE) {
          throw new Error("Video exceeds 100 MB limit.");
        }

        // Create DB row first to get the video ID
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
        const { data: video, error: insertErr } = await supabase
          .from("form_videos")
          .insert({
            user_id: userId,
            storage_path: "", // placeholder, updated after upload
            original_filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .select("id")
          .single();

        if (insertErr || !video) throw new Error("Failed to create video record");

        const storagePath = `${userId}/${video.id}.${ext}`;

        // Upload to private bucket (with timeout to prevent infinite spinner)
        const { error: uploadErr } = await withTimeout(
          supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            }),
          UPLOAD_TIMEOUT_MS,
          "Video upload",
        );

        if (uploadErr) {
          // Clean up DB row
          await supabase.from("form_videos").delete().eq("id", video.id);
          throw new Error(
            uploadErr.message?.includes("Bucket not found")
              ? "Storage not configured. Contact support."
              : `Failed to upload video: ${uploadErr.message || "unknown error"}`,
          );
        }

        // Update storage path
        await supabase
          .from("form_videos")
          .update({ storage_path: storagePath })
          .eq("id", video.id);

        return { videoId: video.id as string, storagePath };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [userId, supabase],
  );

  // ── Analyze ──
  const analyze = useCallback(
    async (
      videoId: string,
      selectedExercise: string | null,
    ): Promise<AnalyzeResult | null> => {
      setError(null);
      setLimitReached(false);
      setAnalyzing(true);

      try {
        // Get the video file for frame extraction
        const { data: video } = await supabase
          .from("form_videos")
          .select("storage_path, duration_seconds")
          .eq("id", videoId)
          .single();

        if (!video) throw new Error("Video not found");

        // Download video blob for frame extraction
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BUCKET)
          .download(video.storage_path);

        if (dlErr || !blob) throw new Error("Failed to download video for analysis");

        const file = new File([blob], "video.mp4", { type: "video/mp4" });
        const { frames, duration } = await extractFrames(file);

        if (frames.length === 0) {
          throw new Error("Could not extract frames from video");
        }

        const res = await fetch("/api/form-check/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            selectedExercise,
            durationSeconds: Math.round(duration),
            frames,
          }),
        });

        if (res.status === 429) {
          setLimitReached(true);
          throw new Error("Daily analysis limit reached (10/day)");
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Analysis failed");
        }

        const result: AnalyzeResult = await res.json();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [supabase],
  );

  // ── Retry (same as analyze, resets video status first) ──
  const retry = useCallback(
    async (
      videoId: string,
      selectedExercise: string | null,
    ): Promise<AnalyzeResult | null> => {
      await supabase
        .from("form_videos")
        .update({ analysis_status: "pending", analysis_error: null })
        .eq("id", videoId);
      return analyze(videoId, selectedExercise);
    },
    [supabase, analyze],
  );

  // ── Delete ──
  const deleteVideo = useCallback(
    async (videoId: string, storagePath: string) => {
      setError(null);
      // Delete storage object
      await supabase.storage.from(BUCKET).remove([storagePath]);
      // Delete DB row (cascades to reports + issues)
      await supabase.from("form_videos").delete().eq("id", videoId);
      // Remove from local state
      setHistory((prev) => prev.filter((h) => h.video_id !== videoId));
    },
    [supabase],
  );

  // ── History ──
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingHistory(true);

    try {
      const { data, error: histErr } = await supabase
        .from("form_analysis_reports")
        .select(
          `
          id,
          video_id,
          selected_exercise,
          detected_exercise,
          overall_score,
          summary,
          analyzed_at,
          praise,
          recommendations,
          safety_notes,
          exercise_confidence,
          form_videos!inner(uploaded_at, expires_at, storage_path)
        `,
        )
        .eq("user_id", userId)
        .order("analyzed_at", { ascending: false })
        .limit(20);

      if (histErr) throw histErr;

      const items: FormHistoryItem[] = (data ?? []).map((r: any) => ({
        id: r.id,
        video_id: r.video_id,
        selected_exercise: r.selected_exercise,
        detected_exercise: r.detected_exercise,
        overall_score: r.overall_score,
        summary: r.summary,
        analyzed_at: r.analyzed_at,
        video_uploaded_at: r.form_videos.uploaded_at,
        video_expires_at: r.form_videos.expires_at,
        video_storage_path: r.form_videos.storage_path,
        praise: r.praise ?? [],
        recommendations: r.recommendations ?? [],
        safety_notes: r.safety_notes ?? [],
        exercise_confidence: r.exercise_confidence,
      }));

      setHistory(items);
    } catch {
      setError("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  }, [userId, supabase]);

  // ── Load full report (with issues) for a history item ──
  const loadFullReport = useCallback(
    async (reportId: string): Promise<AnalyzeResult | null> => {
      try {
        // Fetch the report from history (already loaded) for base fields
        const historyItem = history.find((h) => h.id === reportId);

        // Fetch issues for this report
        const { data: issues, error: issuesErr } = await supabase
          .from("form_analysis_issues")
          .select("body_part, issue_type, severity, timestamp_seconds, description, correction, cue, confidence, sort_order")
          .eq("report_id", reportId)
          .order("sort_order", { ascending: true });

        if (issuesErr) throw issuesErr;

        if (!historyItem) {
          setError("Report not found");
          return null;
        }

        return {
          reportId: historyItem.id,
          overallScore: historyItem.overall_score,
          summary: historyItem.summary,
          detectedExercise: historyItem.detected_exercise,
          exerciseConfidence: historyItem.exercise_confidence ?? "low",
          issues: (issues ?? []).map((i: any) => ({
            body_part: i.body_part,
            issue_type: i.issue_type,
            severity: i.severity,
            timestamp_seconds: i.timestamp_seconds,
            description: i.description,
            correction: i.correction,
            cue: i.cue,
            confidence: i.confidence,
          })),
          praise: historyItem.praise,
          recommendations: historyItem.recommendations,
          safetyNotes: historyItem.safety_notes,
        };
      } catch {
        setError("Failed to load report details");
        return null;
      }
    },
    [supabase, history],
  );

  // ── Signed URL ──
  const getSignedUrl = useCallback(
    async (storagePath: string): Promise<string | null> => {
      const { data, error: urlErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL);

      if (urlErr || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    [supabase],
  );

  return {
    upload,
    analyze,
    deleteVideo,
    retry,
    loadHistory,
    loadFullReport,
    getSignedUrl,
    history,
    uploading,
    analyzing,
    loadingHistory,
    error,
    limitReached,
  };
}
