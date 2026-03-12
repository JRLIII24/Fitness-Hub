"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, Calendar, Target, Dumbbell, Clock, Zap, AlertCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicProgram, ProgramData, ProgramWeek } from "./program-types";

// ── goal → color mapping (same as program-card) ─────────────────────────────

const GOAL_COLORS: Record<string, { from: string; to: string; label: string; color: string }> = {
  strength:    { from: "#f43f5e", to: "#9f1239", label: "Strength",    color: "#f87171" },
  hypertrophy: { from: "#a78bfa", to: "#4c1d95", label: "Hypertrophy", color: "#c4b5fd" },
  general:     { from: "#38bdf8", to: "#0369a1", label: "General",     color: "#7dd3fc" },
  weight_loss: { from: "#a3e635", to: "#365314", label: "Weight Loss", color: "#bef264" },
};

function getGoalColor(goal: string) {
  return GOAL_COLORS[goal.toLowerCase()] ?? GOAL_COLORS.general;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ── component ────────────────────────────────────────────────────────────────

interface ProgramPreviewDialogProps {
  program: PublicProgram | null;
  onImport: () => Promise<void>;
  onClose: () => void;
  onViewPrograms?: () => void;
}

export function ProgramPreviewDialog({
  program,
  onImport,
  onClose,
  onViewPrograms,
}: ProgramPreviewDialogProps) {
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

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {program && (
        <ProgramPreviewSheet
          program={program}
          importState={importState}
          onImport={handleImport}
          onClose={() => { setImportState("idle"); onClose(); }}
          onViewPrograms={onViewPrograms}
          onRetry={() => setImportState("idle")}
        />
      )}
    </AnimatePresence>,
    portalTarget,
  );
}

// ── inner sheet ─────────────────────────────────────────────────────────────

function ProgramPreviewSheet({
  program, importState, onImport, onClose, onViewPrograms, onRetry,
}: {
  program: PublicProgram;
  importState: "idle" | "loading" | "done" | "error";
  onImport: () => void;
  onClose: () => void;
  onViewPrograms?: () => void;
  onRetry?: () => void;
}) {
  const gc = getGoalColor(program.goal);
  const creatorName = program.creator?.display_name ?? "Unknown";
  const programData = program.program_data as ProgramData | null;
  const weeks = programData?.weeks ?? [];
  const totalDays = weeks.reduce((sum, w) => sum + w.days.length, 0);
  const totalExercises = weeks.reduce(
    (sum, w) => sum + w.days.reduce((ds, d) => ds + d.exercises.length, 0), 0,
  );

  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);

  function toggleWeek(weekNum: number) {
    setExpandedWeek(prev => prev === weekNum ? null : weekNum);
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-1rem))] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-t-3xl glass-surface-modal"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-0 pt-3">
          <div className="h-1 w-9 rounded-full bg-border/50" />
        </div>

        {/* ── Gradient header ───────────────────────────────────────────── */}
        <div
          className="relative shrink-0 border-b border-border/40 px-5 pb-4 pt-4"
          style={{ background: `linear-gradient(145deg, ${gc.from}50, ${gc.to}30)` }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-card/70" />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close program preview"
            className="absolute right-4 top-3.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-sm transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title */}
          <div className="relative">
            {/* Program badge */}
            <span
              className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: `${gc.color}20`, color: gc.color }}
            >
              <Calendar className="h-2.5 w-2.5" />
              {program.weeks}-Week Program
            </span>

            <h2 className="mb-1 line-clamp-2 pr-10 text-[20px] font-black leading-tight tracking-tight text-foreground">
              {program.name}
            </h2>

            {/* Author row */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                style={{ background: `${gc.color}20`, border: `1.5px solid ${gc.color}44`, color: gc.color }}
              >
                {initials(creatorName)}
              </div>
              <span className="text-[13px] text-muted-foreground">by {creatorName}</span>
              {/* Goal badge */}
              <span
                className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize"
                style={{ background: `${gc.color}18`, color: gc.color }}
              >
                {gc.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">

          {/* Stats row */}
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {[
              { icon: <Calendar className="h-3.5 w-3.5 text-primary" />, val: `${program.weeks}`, sub: "weeks" },
              { icon: <Dumbbell className="h-3.5 w-3.5 text-sky-400" />, val: `${program.days_per_week}`, sub: "days/week" },
              { icon: <Target className="h-3.5 w-3.5 text-amber-400" />, val: `${totalDays}`, sub: "sessions" },
            ].map(s => (
              <div
                key={s.sub}
                className="flex flex-col items-center justify-center rounded-xl glass-inner px-2 py-3 text-center"
              >
                <div className="mb-1.5 flex justify-center">{s.icon}</div>
                <span className="tabular-nums text-[17px] font-black leading-none text-foreground">{s.val}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.sub}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {program.description && (
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
              {program.description}
            </p>
          )}

          {/* ── Week-by-week overview ─────────────────────────────────── */}
          {weeks.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-3 text-[13px] font-bold text-foreground">Week-by-Week Overview</h3>

              <div className="flex flex-col gap-2">
                {weeks.map((week) => (
                  <WeekAccordion
                    key={week.week_number}
                    week={week}
                    isExpanded={expandedWeek === week.week_number}
                    onToggle={() => toggleWeek(week.week_number)}
                    goalColor={gc.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Summary pill */}
          <div className="mb-5 flex items-center gap-3 rounded-xl glass-inner px-4 py-3">
            <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: gc.color }} />
            <p className="text-[12px] text-muted-foreground">
              <span className="font-bold capitalize" style={{ color: gc.color }}>{gc.label}</span>
              {" "}&middot; {program.weeks} weeks &middot; {totalDays} sessions &middot; {totalExercises} exercises
            </p>
          </div>
        </div>

        {/* ── CTA row ──────────────────────────────────────────────────── */}
        <div className="border-t border-border/40 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          {importState === "done" ? (
            <>
              <p className="mb-3 text-center text-[11px] text-muted-foreground">
                Program imported to your library
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onViewPrograms}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-none bg-primary px-4 py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_6px_20px_rgba(200,255,0,0.25)] transition-all duration-200"
              >
                <Calendar className="h-4 w-4" />
                View My Programs
              </motion.button>
            </>
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
              {importState === "loading" ? "Importing..." : "Import Program"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── week accordion ──────────────────────────────────────────────────────────

function WeekAccordion({
  week, isExpanded, onToggle, goalColor,
}: {
  week: ProgramWeek;
  isExpanded: boolean;
  onToggle: () => void;
  goalColor: string;
}) {
  const totalSets = week.days.reduce(
    (sum, d) => sum + d.exercises.reduce((es, e) => es + e.sets, 0), 0,
  );

  return (
    <div className="rounded-xl glass-inner overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `${goalColor}15`, color: goalColor }}
          >
            W{week.week_number}
          </span>
          <span className="text-[12px] font-semibold text-foreground">{week.focus}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {week.days.length}d &middot; {totalSets} sets
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-3 py-2.5 space-y-2">
              {week.days.map((day) => (
                <div key={day.day_number} className="rounded-lg bg-card/40 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Day {day.day_number}
                    </span>
                    <span className="text-[11px] font-bold text-foreground">{day.name}</span>
                  </div>

                  <div className="space-y-0.5">
                    {day.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <Dumbbell className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
                        <span className="truncate text-muted-foreground">{ex.exercise_name}</span>
                        <span className="ml-auto shrink-0 tabular-nums font-semibold text-foreground/70">
                          {ex.sets}x{ex.reps}
                          {ex.rpe_target ? ` @${ex.rpe_target}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
