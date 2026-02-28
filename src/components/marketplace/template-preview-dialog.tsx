"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download,
  Dumbbell, BarChart3, Clock, Zap, Play, Library, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMuscleColor } from "./muscle-colors";
import { stripImportFingerprint, getDifficultyInfo } from "@/lib/template-utils";
import { StarRatingInput } from "./star-rating-input";
import { ReviewsSection } from "./reviews-section";
import type { PublicTemplate } from "@/types/pods";

// ── helpers ────────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ── component ─────────────────────────────────────────────────────────────────

interface TemplatePreviewDialogProps {
  template: PublicTemplate | null;
  isSaved: boolean;
  onSave: () => void;
  onImport: () => Promise<void>;
  onClose: () => void;
  currentUserId?: string;
  importedTemplateId?: string | null;
  onStartWorkout?: (templateId: string) => void;
  onViewLibrary?: () => void;
}

export function TemplatePreviewDialog({
  template,
  isSaved,
  onSave,
  onImport,
  onClose,
  currentUserId,
  importedTemplateId,
  onStartWorkout,
  onViewLibrary,
}: TemplatePreviewDialogProps) {
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleImport() {
    if (importState === "loading" || importState === "done") return;
    setImportState("loading");
    try {
      await onImport();
      setImportState("done");
    } catch {
      setImportState("error");
    }
  }

  return (
    <AnimatePresence>
      {template && (
        <PreviewSheet
          template={template}
          importState={importState}
          onImport={handleImport}
          onClose={() => { setImportState("idle"); onClose(); }}
          currentUserId={currentUserId}
          importedTemplateId={importedTemplateId}
          onStartWorkout={onStartWorkout}
          onViewLibrary={onViewLibrary}
          onRetry={() => setImportState("idle")}
        />
      )}
    </AnimatePresence>
  );
}

// ── inner sheet (extracted so AnimatePresence can unmount cleanly) ─────────────

function PreviewSheet({
  template, importState, onImport, onClose, currentUserId,
  importedTemplateId, onStartWorkout, onViewLibrary, onRetry,
}: {
  template: PublicTemplate;
  importState: "idle" | "loading" | "done" | "error";
  onImport: () => void;
  onClose: () => void;
  currentUserId?: string;
  importedTemplateId?: string | null;
  onStartWorkout?: (templateId: string) => void;
  onViewLibrary?: () => void;
  onRetry?: () => void;
}) {
  const isOwn = !!currentUserId && template.user_id === currentUserId;
  const exercises = template.template_exercises ?? [];
  const primaryGroup = exercises[0]?.exercises?.muscle_group ?? "Full Body";
  const gc = getMuscleColor(primaryGroup);
  const diff = getDifficultyInfo(template.difficulty_level ?? "grind");
  const totalSets = exercises.reduce((s, e) => s + (e.target_sets ?? 0), 0);
  const creatorName = template.creator?.display_name ?? "Unknown";
  const description = stripImportFingerprint(template.description);

  const muscleGroups = [
    ...new Set(exercises.map(te => te.exercises?.muscle_group).filter(Boolean) as string[]),
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card/95 shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-0 pt-3">
          <div className="h-1 w-9 rounded-full bg-border/50" />
        </div>

        {/* ── Gradient header ──────────────────────────────────────────── */}
        <div
          className="relative shrink-0 border-b border-border/40 px-5 pb-4 pt-4"
          style={{ background: `linear-gradient(145deg, ${gc.from}50, ${gc.to}30)` }}
        >
          {/* bottom fade */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-card/70" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-sm transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title */}
          <div className="relative">
            <h2 className="mb-1 line-clamp-2 pr-10 text-[20px] font-black leading-tight tracking-tight text-foreground">
              {template.name}
            </h2>
            {/* Author + rating row */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                style={{ background: gc.bgAlpha, border: `1.5px solid ${gc.borderAlpha}`, color: gc.labelColor }}
              >
                {initials(creatorName)}
              </div>
              <span className="text-[13px] text-muted-foreground">by {creatorName}</span>
              {/* difficulty */}
              <span
                className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                style={{ background: `${diff.color}18`, color: diff.color }}
              >
                {diff.label}
              </span>
            </div>
            {/* Rating row */}
            {(template.review_count ?? 0) > 0 && (
              <div className="relative mt-2 flex items-center gap-2">
                <StarRatingInput value={template.avg_rating ?? 0} readonly size="sm" />
                <span className="text-[11px] font-bold" style={{ color: "hsl(var(--primary))" }}>
                  {(template.avg_rating ?? 0).toFixed(1)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ({template.review_count} {template.review_count === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        {/* min-h-0 is critical for flex-1 + overflow-y-auto to work properly */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">

          {/* Stats row */}
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {[
              { icon: <Dumbbell className="h-3.5 w-3.5 text-primary" />, val: exercises.length, sub: "exercises" },
              { icon: <BarChart3 className="h-3.5 w-3.5 text-sky-400" />, val: totalSets || "—", sub: "total sets" },
              { icon: <Clock className="h-3.5 w-3.5 text-amber-400" />, val: template.estimated_duration_min ? `${template.estimated_duration_min}m` : "—", sub: "duration" },
            ].map(s => (
              <div
                key={s.sub}
                className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/40 px-2 py-3 text-center"
              >
                <div className="mb-1.5 flex justify-center">{s.icon}</div>
                <span className="tabular-nums text-[17px] font-black leading-none text-foreground">{s.val}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.sub}</span>
              </div>
            ))}
          </div>

          {/* Muscle group tags */}
          {muscleGroups.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-1.5">
              {muscleGroups.map(g => {
                const mgc = getMuscleColor(g);
                return (
                  <span
                    key={g}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: mgc.bgAlpha, color: mgc.labelColor, border: `1px solid ${mgc.borderAlpha}` }}
                  >
                    {g}
                  </span>
                );
              })}
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          )}

          {/* ── Exercise table ────────────────────────────────────────── */}
          {exercises.length > 0 && (
            <div className="mb-5">
              {/* Column headers */}
              <div className="mb-2 grid grid-cols-[1fr_40px_52px_56px] gap-2 px-3">
                {["Exercise", "Sets", "Reps", "Weight"].map(h => (
                  <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                {exercises
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((te, i) => (
                    <motion.div
                      key={te.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "grid grid-cols-[1fr_40px_52px_56px] items-center gap-2 rounded-xl border border-border/50 px-3 py-2.5",
                        i % 2 === 0 ? "bg-card/40" : "bg-card/20",
                      )}
                    >
                      <span className="truncate text-[12px] font-semibold text-foreground">
                        {te.exercises?.name ?? "Unknown exercise"}
                      </span>
                      <span className="tabular-nums text-center text-[14px] font-black text-primary">
                        {te.target_sets ?? "—"}
                      </span>
                      <span className="text-center text-[11px] text-sky-400">
                        {te.target_reps ?? "—"}
                      </span>
                      <span className="text-right text-[11px] text-muted-foreground">
                        {te.target_weight_kg ? `${te.target_weight_kg}kg` : "BW"}
                      </span>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}

          {/* Summary pill */}
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3">
            <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: diff.color }} />
            <p className="text-[12px] text-muted-foreground">
              <span className="font-bold" style={{ color: diff.color }}>{diff.label}</span>
              {template.estimated_duration_min && (
                <> · {template.estimated_duration_min} min</>
              )}
              {" · "}{exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Reviews section */}
          <ReviewsSection
            templateId={template.id}
            currentUserId={currentUserId}
            isOwn={isOwn}
            avgRating={template.avg_rating}
            reviewCount={template.review_count}
          />
        </div>

        {/* ── CTA row ──────────────────────────────────────────────────── */}
        <div className="border-t border-border/40 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          {importState === "done" ? (
            <>
              {/* Post-import context */}
              <p className="mb-3 text-center text-[11px] text-muted-foreground">
                Saved to your library — ready when you are
              </p>
              <div className="flex gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => importedTemplateId && onStartWorkout?.(importedTemplateId)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-none bg-primary px-4 py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_6px_20px_rgba(200,255,0,0.25)] transition-all duration-200"
                >
                  <Play className="h-4 w-4" />
                  Start Workout
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onViewLibrary}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-[13px] font-bold text-foreground transition-all duration-200"
                >
                  <Library className="h-4 w-4" />
                  View Library
                </motion.button>
              </div>
            </>
          ) : isOwn ? (
            /* Own template: read-only — no save action */
            <div className="flex items-center justify-center rounded-2xl border border-border/50 bg-card/40 px-4 py-3.5">
              <span className="text-[13px] font-semibold text-muted-foreground">This is your template</span>
            </div>
          ) : importState === "error" ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3.5 text-[13px] font-bold text-rose-400 transition-all duration-200"
            >
              <AlertCircle className="h-4 w-4" />
              Failed — Tap to retry
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onImport}
              disabled={importState === "loading"}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl border-none px-4 py-3.5 text-[13px] font-bold transition-all duration-200",
                "bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(200,255,0,0.25)]",
                importState === "loading" && "cursor-not-allowed opacity-90",
              )}
            >
              {importState === "loading" ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="flex h-4 w-4 items-center justify-center"
                >
                  <Zap className="h-4 w-4" />
                </motion.span>
              ) : (
                <Download className="h-4 w-4" />
              )}
              {importState === "loading" ? "Saving…" : "Save to Library"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </>
  );
}
