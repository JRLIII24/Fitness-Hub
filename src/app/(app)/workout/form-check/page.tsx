"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Lock,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  MessageCircle,
  Clock,
  Shield,
  ThumbsUp,
  ChevronRight,
  History,
  Video,
} from "lucide-react";
import { FORM_ANALYSIS_ENABLED } from "@/lib/features";
import { useFormCheck } from "@/hooks/use-form-check";
import { createClient } from "@/lib/supabase/client";
import type { FormAnalysisResult } from "@/lib/form-analysis/types";

// ── Severity badge colors ──

const severityColors = {
  major: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  moderate: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  minor: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
};

// ── Score ring color ──

function scoreColor(score: number) {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#eab308";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  if (score >= 30) return "Poor";
  return "Dangerous";
}

// ── Types ──

type View = "upload" | "analyzing" | "report" | "history";

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

export default function FormCheckPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<View>("upload");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<string[]>([]);
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);
  const [report, setReport] = useState<AnalyzeResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const {
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
  } = useFormCheck(userId);

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Load exercise names for autocomplete
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("exercises")
      .select("name")
      .order("name")
      .then(({ data }) => {
        if (data) setExerciseOptions([...new Set(data.map((e) => e.name))]);
      });
  }, []);

  // Fetch signed video URL when report is shown
  useEffect(() => {
    if (view === "report" && currentStoragePath && !videoUrl) {
      getSignedUrl(currentStoragePath).then((url) => {
        if (url) setVideoUrl(url);
      });
    }
  }, [view, currentStoragePath, videoUrl, getSignedUrl]);

  const filteredExercises = exerciseSearch
    ? exerciseOptions.filter((e) =>
        e.toLowerCase().includes(exerciseSearch.toLowerCase()),
      ).slice(0, 8)
    : exerciseOptions.slice(0, 8);

  // ── Handlers ──

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const uploadResult = await upload(file);
      if (!uploadResult) return;

      setCurrentVideoId(uploadResult.videoId);
      setCurrentStoragePath(uploadResult.storagePath);
      setView("analyzing");

      // Resolve exercise: use explicit selection, or fuzzy-match typed text against options
      let exercise = selectedExercise;
      if (!exercise && exerciseSearch.trim()) {
        const typed = exerciseSearch.trim().toLowerCase();
        const exactMatch = exerciseOptions.find(
          (o) => o.toLowerCase() === typed,
        );
        exercise = exactMatch ?? exerciseSearch.trim();
        setSelectedExercise(exercise);
      }

      const result = await analyze(uploadResult.videoId, exercise);
      if (result) {
        setReport(result);
        setView("report");
      } else {
        setView("upload");
      }
    },
    [upload, analyze, selectedExercise, exerciseSearch, exerciseOptions],
  );

  const handleRetry = useCallback(async () => {
    if (!currentVideoId) return;
    setView("analyzing");
    // Same resolution logic as handleFileSelect
    let exercise = selectedExercise;
    if (!exercise && exerciseSearch.trim()) {
      const typed = exerciseSearch.trim().toLowerCase();
      const exactMatch = exerciseOptions.find(
        (o) => o.toLowerCase() === typed,
      );
      exercise = exactMatch ?? exerciseSearch.trim();
    }
    const result = await retry(currentVideoId, exercise);
    if (result) {
      setReport(result);
      setView("report");
    } else {
      setView("upload");
    }
  }, [currentVideoId, retry, selectedExercise, exerciseSearch, exerciseOptions]);

  const handleDelete = useCallback(async () => {
    if (!currentVideoId || !currentStoragePath) return;
    await deleteVideo(currentVideoId, currentStoragePath);
    setReport(null);
    setCurrentVideoId(null);
    setCurrentStoragePath(null);
    setView("upload");
  }, [currentVideoId, currentStoragePath, deleteVideo]);

  const handleNewCheck = useCallback(() => {
    setReport(null);
    setCurrentVideoId(null);
    setCurrentStoragePath(null);
    setSelectedExercise(null);
    setExerciseSearch("");
    setVideoUrl(null);
    setView("upload");
  }, []);

  const handleShowHistory = useCallback(() => {
    loadHistory();
    setView("history");
  }, [loadHistory]);

  const handleHistoryCardClick = useCallback(
    async (item: (typeof history)[number]) => {
      const fullReport = await loadFullReport(item.id);
      if (!fullReport) return;

      setReport(fullReport);
      setCurrentVideoId(item.video_id);
      setCurrentStoragePath(item.video_storage_path);
      setVideoUrl(null); // reset so the useEffect fetches fresh signed URL
      setView("report");
    },
    [loadFullReport],
  );

  // ── Feature gate ──

  if (!FORM_ANALYSIS_ENABLED) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border/60 bg-card/30">
          <Camera className="h-9 w-9 text-muted-foreground/60" />
        </div>
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400">
          <Lock className="h-3 w-3" />
          Coming Soon
        </span>
        <h1 className="mb-2 text-[20px] font-black tracking-tight text-foreground">
          AI Form Analysis
        </h1>
        <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Record your lifts and get AI-powered feedback on your technique.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[70dvh] px-4 pb-32 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-black tracking-tight text-foreground">
            Form Check
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            AI-powered exercise form analysis
          </p>
        </div>
        {view !== "history" && (
          <button
            onClick={handleShowHistory}
            className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        )}
        {view === "history" && (
          <button
            onClick={handleNewCheck}
            className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Camera className="h-3.5 w-3.5" />
            New Check
          </button>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="text-[12px] leading-relaxed text-red-300">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* ── UPLOAD VIEW ── */}
        {view === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {/* Exercise selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Exercise (optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Barbell Squat"
                  value={exerciseSearch}
                  onChange={(e) => {
                    setExerciseSearch(e.target.value);
                    setShowExerciseDropdown(true);
                    if (!e.target.value) setSelectedExercise(null);
                  }}
                  onFocus={() => setShowExerciseDropdown(true)}
                  onBlur={() => setTimeout(() => setShowExerciseDropdown(false), 200)}
                  className="w-full rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                />
                {selectedExercise && (
                  <button
                    onClick={() => {
                      setSelectedExercise(null);
                      setExerciseSearch("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {showExerciseDropdown && filteredExercises.length > 0 && !selectedExercise && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl">
                    {filteredExercises.map((ex, i) => (
                      <button
                        key={`${ex}-${i}`}
                        onMouseDown={() => {
                          setSelectedExercise(ex);
                          setExerciseSearch(ex);
                          setShowExerciseDropdown(false);
                        }}
                        className="block w-full px-4 py-2.5 text-left text-[13px] text-foreground hover:bg-primary/10"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upload area */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="group flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-card/20 px-6 py-16 transition-colors hover:border-primary/40 hover:bg-card/30 disabled:opacity-50"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-card/40 transition-transform group-hover:scale-105">
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : (
                  <Upload className="h-7 w-7 text-muted-foreground/60" />
                )}
              </div>
              <div className="text-center">
                <p className="text-[14px] font-bold text-foreground">
                  {uploading ? "Uploading..." : "Upload a video of your lift"}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  MP4, MOV, or WebM — up to 100 MB
                </p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileSelect}
              className="hidden"
            />

            {limitReached && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
                <p className="text-[12px] font-semibold text-amber-400">
                  Daily limit reached (10 analyses/day)
                </p>
              </div>
            )}

            {/* Tip */}
            <div className="mt-6 rounded-xl border border-border/40 bg-card/20 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Record from a 45°
                angle, include the full range of motion, and ensure good lighting for
                the best analysis.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── ANALYZING VIEW ── */}
        {view === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex min-h-[50dvh] flex-col items-center justify-center text-center"
          >
            <div className="relative mb-6">
              <div className="h-20 w-20 animate-pulse rounded-3xl border border-primary/30 bg-primary/10" />
              <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary" />
            </div>
            <h2 className="mb-2 text-[18px] font-black text-foreground">
              Analyzing Your Form
            </h2>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              Our AI is reviewing your video frame by frame. This may take up to 45
              seconds.
            </p>
          </motion.div>
        )}

        {/* ── REPORT VIEW ── */}
        {view === "report" && report && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Score hero */}
            <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-center">
              <div className="relative mx-auto mb-4 h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-border/30"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={scoreColor(report.overallScore)}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(report.overallScore / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-[28px] font-black tabular-nums leading-none"
                    style={{ color: scoreColor(report.overallScore) }}
                  >
                    {report.overallScore}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-bold" style={{ color: scoreColor(report.overallScore) }}>
                {scoreLabel(report.overallScore)}
              </p>
              {report.detectedExercise && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {report.detectedExercise}
                  {report.exerciseConfidence && (
                    <span className="ml-1 opacity-60">
                      ({report.exerciseConfidence} confidence)
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Video preview */}
            {videoUrl && (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  <h3 className="text-[13px] font-bold text-foreground">
                    Your Video
                  </h3>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Tap timestamps below to jump
                  </span>
                </div>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                  style={{ maxHeight: 280 }}
                />
              </div>
            )}

            {/* Summary */}
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <p className="text-[13px] leading-relaxed text-foreground/90">
                {report.summary}
              </p>
            </div>

            {/* Praise */}
            {report.praise.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-400" />
                  <h3 className="text-[13px] font-bold text-foreground">
                    What You&apos;re Doing Well
                  </h3>
                </div>
                <ul className="space-y-2">
                  {report.praise.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/80"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {report.issues.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-[13px] font-bold text-foreground">
                    Form Issues ({report.issues.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {report.issues.map((issue, i) => {
                    const sev = severityColors[issue.severity];
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border/50 bg-card/40 p-3"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className={`rounded-full ${sev.bg} ${sev.border} border px-2 py-0.5 text-[10px] font-bold uppercase ${sev.text}`}
                          >
                            {issue.severity}
                          </span>
                          <span className="text-[11px] font-semibold text-foreground/70">
                            {issue.body_part.replace(/_/g, " ")}
                          </span>
                          {issue.timestamp_seconds != null && (
                            <button
                              onClick={() => {
                                if (videoRef.current && issue.timestamp_seconds != null) {
                                  videoRef.current.currentTime = issue.timestamp_seconds;
                                  videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                              }}
                              className="ml-auto flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/20"
                            >
                              <Clock className="h-3 w-3" />
                              {issue.timestamp_seconds}s
                            </button>
                          )}
                        </div>
                        <p className="mb-1.5 text-[12px] leading-relaxed text-foreground/80">
                          {issue.description}
                        </p>
                        <p className="text-[12px] leading-relaxed text-primary/80">
                          <strong>Fix:</strong> {issue.correction}
                        </p>
                        {issue.cue && (
                          <p className="mt-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary">
                            Cue: &ldquo;{issue.cue}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
                <h3 className="mb-3 text-[13px] font-bold text-foreground">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/80"
                    >
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Safety notes */}
            {report.safetyNotes.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card/20 p-3">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    {report.safetyNotes.map((note, i) => (
                      <p
                        key={i}
                        className="text-[11px] leading-relaxed text-muted-foreground"
                      >
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {currentVideoId && currentStoragePath && (
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleNewCheck}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/40 py-3 text-[13px] font-bold text-foreground transition-colors hover:bg-card/60"
              >
                <Camera className="h-4 w-4" />
                New Check
              </button>
              <button
                onClick={() => router.push("/workout")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" />
                Ask Coach
              </button>
            </div>
          </motion.div>
        )}

        {/* ── HISTORY VIEW ── */}
        {view === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {loadingHistory ? (
              <div className="flex min-h-[40dvh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex min-h-[40dvh] flex-col items-center justify-center text-center">
                <Video className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-[14px] font-bold text-foreground">
                  No analyses yet
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Upload a video to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => {
                  const exercise =
                    item.detected_exercise ?? item.selected_exercise ?? "Unknown";
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryCardClick(item)}
                      className="w-full rounded-2xl border border-border/60 bg-card/30 p-4 text-left transition-colors hover:bg-card/50 active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-[13px] font-bold text-foreground">
                            {exercise}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(item.analyzed_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl border"
                          style={{
                            borderColor: `${scoreColor(item.overall_score)}40`,
                            backgroundColor: `${scoreColor(item.overall_score)}15`,
                          }}
                        >
                          <span
                            className="text-[18px] font-black tabular-nums"
                            style={{ color: scoreColor(item.overall_score) }}
                          >
                            {item.overall_score}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-foreground/70">
                        {item.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
