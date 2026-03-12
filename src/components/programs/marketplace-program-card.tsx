"use client";

import { motion } from "framer-motion";
import { Calendar, Target, Dumbbell, Clock, User } from "lucide-react";
import type { PublicProgram } from "./program-types";

// ── goal → color mapping ────────────────────────────────────────────────────

const GOAL_COLORS: Record<string, { from: string; to: string; label: string; color: string; bg: string; border: string }> = {
  strength:    { from: "#f43f5e", to: "#9f1239", label: "Strength",    color: "#f87171", bg: "#f43f5e18", border: "#f43f5e44" },
  hypertrophy: { from: "#a78bfa", to: "#4c1d95", label: "Hypertrophy", color: "#c4b5fd", bg: "#a78bfa18", border: "#a78bfa44" },
  general:     { from: "#38bdf8", to: "#0369a1", label: "General",     color: "#7dd3fc", bg: "#38bdf818", border: "#38bdf844" },
  weight_loss: { from: "#a3e635", to: "#365314", label: "Weight Loss", color: "#bef264", bg: "#a3e63518", border: "#a3e63544" },
};

function getGoalColor(goal: string) {
  return GOAL_COLORS[goal.toLowerCase()] ?? GOAL_COLORS.general;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ── component ────────────────────────────────────────────────────────────────

interface ProgramCardProps {
  program: PublicProgram;
  onPreview: () => void;
}

export function MarketplaceProgramCard({ program, onPreview }: ProgramCardProps) {
  const gc = getGoalColor(program.goal);
  const creatorName = program.creator?.display_name ?? "Unknown";

  // Count total exercises across all weeks/days from program_data
  const programData = program.program_data as { weeks?: Array<{ days?: Array<{ exercises?: unknown[] }> }> } | null;
  const totalDays = programData?.weeks?.reduce((sum, w) => sum + (w.days?.length ?? 0), 0) ?? 0;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onPreview}
      className="cursor-pointer overflow-hidden rounded-2xl glass-surface shimmer-target transition-colors"
    >
      {/* ── Gradient header ────────────────────────────────────────────── */}
      <div
        className="relative h-[64px]"
        style={{ background: `linear-gradient(135deg, ${gc.from}CC, ${gc.to}99)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />

        {/* Program badge — bottom-left */}
        <div className="absolute left-2 bottom-2 flex items-center gap-1.5">
          <span
            className="glass-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ color: gc.color }}
          >
            <Calendar className="h-2.5 w-2.5" />
            {program.weeks}W Program
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3.5 pt-2.5">
        {/* Goal pill */}
        <span
          className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold capitalize"
          style={{ background: gc.bg, color: gc.color }}
        >
          {gc.label}
        </span>

        {/* Program name */}
        <p className="mb-1.5 line-clamp-2 text-[13px] font-black leading-tight tracking-tight text-foreground">
          {program.name}
        </p>

        {/* Description */}
        {program.description && (
          <p className="mb-2 line-clamp-2 text-[10px] text-muted-foreground">
            {program.description}
          </p>
        )}

        {/* Author row */}
        <div className="mb-2.5 flex items-center gap-1.5">
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
            style={{
              background: gc.bg,
              border: `1px solid ${gc.border}`,
              color: gc.color,
            }}
          >
            {initials(creatorName)}
          </div>
          <span className="truncate text-[11px] text-muted-foreground">{creatorName}</span>
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {program.weeks}w
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {program.days_per_week}d/wk
            </span>
          </div>
          {totalDays > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Target className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {totalDays} sessions
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

export function ProgramCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl glass-surface">
      <div className="h-[64px] animate-pulse bg-card/70" />
      <div className="px-3 pb-3.5 pt-2.5">
        <div className="mb-1.5 h-3 w-16 animate-pulse rounded-full bg-card/70" />
        <div className="mb-1.5 h-3.5 w-4/5 animate-pulse rounded bg-card/70" />
        <div className="mb-2 h-3 w-full animate-pulse rounded bg-card/70" />
        <div className="mb-2.5 flex gap-1.5">
          <div className="h-4 w-12 animate-pulse rounded-full bg-card/70" />
          <div className="h-4 w-10 animate-pulse rounded-full bg-card/70" />
        </div>
        <div className="h-2.5 w-2/3 animate-pulse rounded bg-card/70" />
      </div>
    </div>
  );
}
