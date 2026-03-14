"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Dumbbell,
  Trophy,
  TrendingUp,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Apple,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { WeeklyReviewData } from "@/types/weekly-review";

interface WeeklyReviewModalProps {
  weeklySessionCount: number;
  weeklyMomentumGoal: number;
  weeklyProgressPct: number;
  unitLabel: string;
  toDisplayVolume: (kg: number) => number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
        New
      </span>
    );

  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        0%
      </span>
    );

  const isUp = pct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-bold",
        isUp ? "text-emerald-400" : "text-red-400"
      )}
    >
      {isUp ? (
        <ArrowUpRight className="h-2.5 w-2.5" />
      ) : (
        <ArrowDownRight className="h-2.5 w-2.5" />
      )}
      {isUp ? "+" : ""}
      {pct}%
    </span>
  );
}

function ComparisonStat({
  icon,
  label,
  value,
  current,
  previous,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  current: number;
  previous: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl glass-inner px-3 py-4 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-inner">
        {icon}
      </div>
      <span className="font-display tabular-nums text-[22px] font-black leading-none text-[#F0F4FF]">
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
        {label}
      </span>
      <DeltaBadge current={current} previous={previous} />
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/20",
        className ?? "h-20"
      )}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyReviewModal({
  weeklySessionCount,
  weeklyMomentumGoal,
  weeklyProgressPct,
  unitLabel,
  toDisplayVolume,
}: WeeklyReviewModalProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    fetch("/api/weekly-review")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.training) {
          setData(d);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open]);

  const training = data?.training;
  const nutrition = data?.nutrition;

  const maxSets =
    training?.muscle_groups?.length
      ? Math.max(...training.muscle_groups.map((mg) => mg.sets))
      : 1;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="min-h-[44px] gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3" />
        Weekly Review
      </Button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="weekly-review-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                  key="weekly-review-modal"
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] top-auto z-[101] max-h-[85vh] overflow-y-auto rounded-3xl glass-surface-modal sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
                >
                  <div className="space-y-5 p-6">
                    {/* ── Header ──────────────────────────────────── */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Weekly Review
                        </p>
                        <h2 className="mt-1 text-[20px] font-black tracking-tight text-[#F0F4FF]">
                          Your Progress
                        </h2>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>

                    {/* ── Consistency Score ────────────────────────── */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Weekly Consistency
                      </p>
                      <p className="font-display mt-2 tabular-nums text-[48px] font-black leading-none text-primary">
                        {weeklyProgressPct}%
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {weeklySessionCount} of {weeklyMomentumGoal} sessions
                        this week
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{
                            width: `${Math.min(100, weeklyProgressPct)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* ── Week-over-Week Comparison ────────────────── */}
                    {loading ? (
                      <div className="grid grid-cols-2 gap-3">
                        <SkeletonBlock className="h-28" />
                        <SkeletonBlock className="h-28" />
                        <SkeletonBlock className="h-28" />
                        <SkeletonBlock className="h-28" />
                      </div>
                    ) : training ? (
                      <>
                        <div>
                          <p className="mb-3 text-[13px] font-bold text-foreground">
                            vs Last Week
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <ComparisonStat
                              icon={
                                <Zap className="h-4 w-4 text-primary" />
                              }
                              label="Sessions"
                              value={training.total_sessions}
                              current={training.total_sessions}
                              previous={training.prev_week_sessions}
                            />
                            <ComparisonStat
                              icon={
                                <Dumbbell className="h-4 w-4 text-primary" />
                              }
                              label={`Volume (${unitLabel})`}
                              value={toDisplayVolume(
                                training.total_volume_kg
                              ).toLocaleString()}
                              current={training.total_volume_kg}
                              previous={training.prev_week_volume}
                            />
                            <ComparisonStat
                              icon={
                                <Timer className="h-4 w-4 text-primary" />
                              }
                              label="Duration"
                              value={formatDuration(
                                training.total_duration_seconds
                              )}
                              current={training.total_duration_seconds}
                              previous={0}
                            />
                            <ComparisonStat
                              icon={
                                <Trophy className="h-4 w-4 text-primary" />
                              }
                              label="PRs Hit"
                              value={training.prs?.length ?? 0}
                              current={training.prs?.length ?? 0}
                              previous={0}
                            />
                          </div>
                        </div>

                        {/* ── Muscle Distribution ─────────────────────── */}
                        {training.muscle_groups?.length > 0 && (
                          <div>
                            <p className="mb-3 text-[13px] font-bold text-foreground">
                              Muscle Groups
                            </p>
                            <div className="space-y-2.5 rounded-xl glass-inner p-4">
                              {training.muscle_groups.map((mg) => {
                                const pct = (mg.sets / maxSets) * 100;
                                return (
                                  <div
                                    key={mg.muscle_group}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="w-20 truncate text-[11px] capitalize text-muted-foreground">
                                      {mg.muscle_group.replace("_", " ")}
                                    </span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="w-8 text-right tabular-nums text-[11px] font-bold text-foreground">
                                      {mg.sets}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── PRs This Week ───────────────────────────── */}
                        <div>
                          <p className="mb-3 text-[13px] font-bold text-foreground">
                            PRs This Week
                          </p>
                          {training.prs?.length > 0 ? (
                            <div className="space-y-2">
                              {training.prs.map((pr, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 rounded-xl glass-inner px-4 py-3"
                                >
                                  <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-semibold text-foreground">
                                      {pr.exercise}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {toDisplayVolume(pr.weight_kg)}{" "}
                                      {unitLabel} x {pr.reps} reps
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-xl glass-inner px-4 py-4 text-center text-[11px] text-muted-foreground">
                              No PRs this week — keep pushing!
                            </p>
                          )}
                        </div>

                        {/* ── Nutrition Compliance ─────────────────────── */}
                        {nutrition && (
                          <div>
                            <p className="mb-3 text-[13px] font-bold text-foreground">
                              Nutrition
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex flex-col items-center gap-1 rounded-xl glass-inner px-3 py-3 text-center">
                                <Apple className="h-3.5 w-3.5 text-[var(--status-positive)]" />
                                <span className="tabular-nums text-[18px] font-black leading-none text-[#F0F4FF]">
                                  {nutrition.days_tracked}
                                  <span className="text-[11px] font-normal text-muted-foreground">
                                    /7
                                  </span>
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                  Days Tracked
                                </span>
                              </div>
                              <div className="flex flex-col items-center gap-1 rounded-xl glass-inner px-3 py-3 text-center">
                                <span className="tabular-nums text-[18px] font-black leading-none text-[#F0F4FF]">
                                  {Math.round(nutrition.avg_calorie_pct)}%
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                  Avg Calories
                                </span>
                              </div>
                              <div className="flex flex-col items-center gap-1 rounded-xl glass-inner px-3 py-3 text-center">
                                <span className="tabular-nums text-[18px] font-black leading-none text-[#F0F4FF]">
                                  {Math.round(nutrition.avg_protein_pct)}%
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                  Avg Protein
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : error ? (
                      <div className="rounded-xl glass-inner px-4 py-6 text-center">
                        <p className="text-[12px] font-semibold text-muted-foreground">
                          Unable to load weekly data
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/60">
                          Check that the weekly training summary RPC is deployed
                        </p>
                      </div>
                    ) : null}

                    {/* ── Motivational ──────────────────────────────── */}
                    <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
                      Consistency compounds. Every session you log adds
                      momentum to your trajectory.
                    </p>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
