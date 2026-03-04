"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Dumbbell, Trophy, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface WeeklyReviewModalProps {
  streak: number;
  weeklySessionCount: number;
  weeklyMomentumGoal: number;
  weeklyProgressPct: number;
  weeklyAverageSessions: number;
  projectedSessions90d: number;
  projectedVolumeKg: number;
  totalSessions: number;
  unitLabel: string;
  toDisplayVolume: (kg: number) => number;
}

function ReviewStat({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-4 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {subtext && (
        <span className="text-[10px] text-muted-foreground/70">{subtext}</span>
      )}
    </div>
  );
}

export function WeeklyReviewModal({
  streak,
  weeklySessionCount,
  weeklyMomentumGoal,
  weeklyProgressPct,
  weeklyAverageSessions,
  projectedSessions90d,
  projectedVolumeKg,
  totalSessions,
  unitLabel,
  toDisplayVolume,
}: WeeklyReviewModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3" />
        Weekly Review
      </Button>

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
              className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] top-auto z-[101] max-h-[85vh] overflow-y-auto rounded-3xl glass-surface-modal glass-highlight sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
            >
              <div className="space-y-5 p-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Weekly Review
                    </p>
                    <h2 className="mt-1 text-[20px] font-black tracking-tight text-foreground">
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

                {/* Consistency Score */}
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Weekly Consistency
                  </p>
                  <p className="mt-2 tabular-nums text-[48px] font-black leading-none text-primary">
                    {weeklyProgressPct}%
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {weeklySessionCount} of {weeklyMomentumGoal} sessions this week
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/40">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, weeklyProgressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <ReviewStat
                    icon={<Flame className="h-4 w-4 text-orange-500" />}
                    label="Day Streak"
                    value={streak}
                  />
                  <ReviewStat
                    icon={<Dumbbell className="h-4 w-4 text-primary" />}
                    label="Avg/Week"
                    value={Math.round(weeklyAverageSessions * 10) / 10}
                  />
                  <ReviewStat
                    icon={<Trophy className="h-4 w-4 text-amber-400" />}
                    label="All-Time"
                    value={totalSessions}
                    subtext="total sessions"
                  />
                  <ReviewStat
                    icon={<Target className="h-4 w-4 text-emerald-400" />}
                    label="90-Day Proj."
                    value={projectedSessions90d}
                    subtext={`${toDisplayVolume(projectedVolumeKg).toLocaleString()} ${unitLabel}`}
                  />
                </div>

                {/* Motivational */}
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
                  Consistency compounds. Every session you log adds momentum to your trajectory.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
