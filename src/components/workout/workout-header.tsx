"use client";

import { memo, useEffect, useState } from "react";
import { Activity, CircleCheck, Clock3, Dumbbell, Layers, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ElapsedTime -- memo-isolated so its 1-second tick does NOT cause the parent
 * WorkoutPage to re-render. startedAt is a stable string for the lifetime of
 * a session, so memo's shallow prop comparison will always bail out.
 */
export const ElapsedTime = memo(function ElapsedTime({
  startedAt,
  className,
}: {
  startedAt: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return <span className={className}>{`${pad(hrs)}:${pad(mins)}:${pad(secs)}`}</span>;
});

export interface WorkoutHeaderProps {
  workoutName: string;
  startedAt: string;
  totalVolumeDisplay: string;
  completedSets: number;
  totalSets: number;
  exerciseCount: number;
  completionProgressPct: number;
  unitLabel: string;
}

/**
 * Active session hero banner with glows, stats badges, and progress bar.
 * Timer is isolated via memo (ElapsedTime) so ticks don't propagate.
 * Memo prevents re-renders from parent when only unrelated state changes.
 */
export const WorkoutHeader = memo(function WorkoutHeader({
  workoutName,
  startedAt,
  totalVolumeDisplay,
  completedSets,
  totalSets,
  exerciseCount,
  completionProgressPct,
  unitLabel,
}: WorkoutHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active Session</p>
            <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">
              {workoutName}
            </h2>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Clock3 className="size-4" />
            <ElapsedTime startedAt={startedAt} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
            <Activity className="mr-1 h-3.5 w-3.5" />
            {totalVolumeDisplay} {unitLabel}
          </Badge>
          <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            <CircleCheck className="mr-1 h-3.5 w-3.5" />
            {completedSets} done
          </Badge>
          <Badge className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-300">
            <Layers className="mr-1 h-3.5 w-3.5" />
            {totalSets} total sets
          </Badge>
          <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-300">
            <Dumbbell className="mr-1 h-3.5 w-3.5" />
            {exerciseCount} exercises
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Session Progress</span>
            <span>{completionProgressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${completionProgressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
});
