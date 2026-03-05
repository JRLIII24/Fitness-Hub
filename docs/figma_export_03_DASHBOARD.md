# Fit-Hub — 03_DASHBOARD Component Source

---
## src/components/dashboard/calorie-ring.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface CalorieRingProps {
  consumed: number;
  goal: number;
}

export const CalorieRing = React.memo(function CalorieRing({ consumed, goal }: CalorieRingProps) {
  const R = 46;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg
        width="116"
        height="116"
        viewBox="0 0 116 116"
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <filter id="calorie-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          className="stroke-border"
        />
        {/* Glow layer */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="10"
          fill="none"
          stroke={isOver ? "rgb(244 63 94)" : "rgb(52 211 153)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#calorie-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        {/* Progress */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          stroke={isOver ? "rgb(244 63 94)" : "rgb(52 211 153)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
          {Math.round(consumed)}
        </span>
        <span className="text-[9px] font-semibold text-muted-foreground">kcal</span>
        <span
          className={cn(
            "mt-0.5 tabular-nums text-[9px] font-bold",
            isOver ? "text-rose-400" : "text-emerald-400"
          )}
        >
          {isOver ? "+" : ""}
          {Math.round(isOver ? consumed - goal : remaining)}{" "}
          {isOver ? "over" : "left"}
        </span>
      </div>
    </div>
  );
});
```

---
## src/components/dashboard/dashboard-card-header.tsx
```tsx
import React from "react";

interface DashboardCardHeaderProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export const DashboardCardHeader = React.memo(function DashboardCardHeader({
  icon,
  title,
  action,
}: DashboardCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
          {icon}
        </div>
        <span className="truncate text-[13px] font-bold text-foreground">{title}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
});
```

---
## src/components/dashboard/dashboard-content.tsx
```tsx
"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { glassMotionVariants } from "@/lib/motion";

import {
  Dumbbell,
  Apple,
  Flame,
  CalendarDays,
  ChevronRight,
  Trophy,
  Target,
  Clock,
  BarChart3,
  Play,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StreakSection } from "@/components/dashboard/streak-section";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";

import { SmartLauncherWidget } from "@/components/workout/smart-launcher-widget";
import { FatigueLevelCard } from "@/components/dashboard/fatigue-level-card";
import { PodsDashboardCard } from "@/components/pods/pods-dashboard-card";
import { XpProgressBar } from "@/components/profile/xp-progress-bar";
import { WeightLogWidget } from "@/components/dashboard/weight-log-widget";
import { MuscleRecoveryCard } from "@/components/dashboard/muscle-recovery-card";
import { WeeklyReviewModal } from "@/components/dashboard/weekly-review-modal";

import { StatPill } from "@/components/dashboard/stat-pill";
import { MacroBar } from "@/components/dashboard/macro-bar";
import { CalorieRing } from "@/components/dashboard/calorie-ring";
import { ProteinRing } from "@/components/dashboard/protein-ring";
import { SectionCard } from "@/components/dashboard/section-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { useDashboardPhase } from "@/hooks/use-dashboard-phase";

import type { FatigueSnapshot } from "@/lib/fatigue/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardPhase = "morning" | "pre_workout" | "active" | "post_workout" | "evening";

type SessionRow = {
  id: string;
  name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume_kg: number | null;
  status: string;
};

type IntentRow = {
  id: string;
  intent_type: string;
  intent_payload: { suggested_goal?: string; suggested_duration_min?: number } | null;
  intent_for_date: string | null;
  status: string;
};

export interface DashboardContentProps {
  userId: string;
  displayName: string;
  todayFormatted: string;
  todayStr: string;
  level: number;
  xp: number;
  streak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  totalSessionCount: number;
  thisWeekSessionCount: number;
  lastWorkout: SessionRow | null;
  workedOutToday: boolean;
  workedOutYesterday: boolean;
  streakAtRisk: boolean;
  momentumUrgency: "low" | "medium" | "high";
  weeklyMomentumGoal: number;
  weeklyProgressPct: number;
  weeklyAverageSessions: number;
  projectedSessions90d: number;
  projectedVolumeKg: number;
  calorieGoal: number | null;
  todayCalories: number;
  todayProtein: number;
  todayCarbs: number;
  todayFat: number;
  todayFiber: number;
  todaySugar: number;
  todaySodiumMg: number;
  todayServings: number;
  nutritionGoal: {
    calories_target: number | null;
    protein_g_target: number | null;
    carbs_g_target: number | null;
    fat_g_target: number | null;
  } | null;
  activeIntent: IntentRow | null;
  quickAddFoods: Array<{ id: string; name: string; brand: string | null }>;
  fatigueSnapshot: FatigueSnapshot;
  dashboardPhase: DashboardPhase;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function CardDivider() {
  return <div className="h-px bg-border/40" />;
}

// ─── DashboardContent ─────────────────────────────────────────────────────────

export function DashboardContent({
  userId,
  displayName,
  todayFormatted,
  level,
  xp,
  streak,
  milestonesUnlocked,
  freezeAvailable,
  totalSessionCount,
  thisWeekSessionCount,
  lastWorkout,
  workedOutToday,
  workedOutYesterday,
  streakAtRisk,
  momentumUrgency,
  weeklyMomentumGoal,
  weeklyProgressPct,
  weeklyAverageSessions,
  projectedSessions90d,
  projectedVolumeKg,
  calorieGoal,
  todayCalories,
  todayProtein,
  todayCarbs,
  todayFat,
  todayFiber,
  todaySugar,
  todaySodiumMg,
  todayServings,
  nutritionGoal,
  activeIntent,
  quickAddFoods,
  fatigueSnapshot,
  dashboardPhase,
}: DashboardContentProps) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const toDisplayVolume = (kgVolume: number) =>
    preference === "imperial"
      ? Math.round(kgToLbs(kgVolume))
      : Math.round(kgVolume);

  const ninetyDayCard = (
    <SectionCard key="ninetyDay">
      <DashboardCardHeader
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
        title="Future Self · 90-Day Path"
        action={
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {Math.round(weeklyAverageSessions * 10) / 10}/wk avg
          </span>
        }
      />
      <CardDivider />
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Stay on this path to complete
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular-nums text-[40px] font-black leading-none text-primary">
              {projectedSessions90d}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">
              workouts in 90 days
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              7-Day Goal
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
                {thisWeekSessionCount}
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">
                /{weeklyMomentumGoal}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              Proj. Volume
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="tabular-nums text-[18px] font-black leading-none text-foreground">
                {toDisplayVolume(projectedVolumeKg).toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{unitLabel}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Weekly momentum progress
            </span>
            <span className="text-[10px] font-bold text-primary">
              {weeklyProgressPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${weeklyProgressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Consistency compounds. Keep stacking sessions to shift this curve up.
        </p>
      </div>
    </SectionCard>
  );

  const nutritionCard = (
    <SectionCard key="nutrition">
      <DashboardCardHeader
        icon={<Apple className="h-3.5 w-3.5 text-emerald-400" />}
        title="Today's Nutrition"
        action={
          <Link href="/nutrition">
            <button className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-opacity hover:opacity-80">
              Log food
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        }
      />
      <CardDivider />
      <div className="space-y-5 p-5">
        {calorieGoal ? (
          <>
            <div className="flex items-center gap-4">
              <CalorieRing consumed={todayCalories} goal={calorieGoal} />
              {nutritionGoal?.protein_g_target ? (
                <ProteinRing consumed={todayProtein} goal={nutritionGoal.protein_g_target} />
              ) : null}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                    Goal
                  </p>
                  <p className="tabular-nums text-[20px] font-black leading-none text-foreground">
                    {calorieGoal.toLocaleString()}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {" "}kcal
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Remaining</p>
                  <p className="tabular-nums text-[18px] font-black leading-none text-emerald-400">
                    {Math.max(0, calorieGoal - todayCalories).toLocaleString()}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {" "}kcal
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {dashboardPhase === "post_workout" && nutritionGoal?.protein_g_target && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] text-primary font-semibold">
                Recovery window — {Math.max(0, (nutritionGoal.protein_g_target ?? 0) - todayProtein)}g protein remaining
              </div>
            )}

            <div className="space-y-3">
              <MacroBar
                label="Protein"
                value={todayProtein}
                goal={nutritionGoal?.protein_g_target ?? null}
                textColorClass="text-blue-400"
                barColorClass="bg-blue-400"
                trackHeight="h-2"
              />
              <MacroBar
                label="Carbs"
                value={todayCarbs}
                goal={nutritionGoal?.carbs_g_target ?? null}
                textColorClass="text-amber-400"
                barColorClass="bg-amber-400"
              />
              <MacroBar
                label="Fat"
                value={todayFat}
                goal={nutritionGoal?.fat_g_target ?? null}
                textColorClass="text-rose-400"
                barColorClass="bg-rose-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/30 p-3 sm:grid-cols-4">
              {[
                { label: "Fiber", value: `${Math.round(todayFiber)}g`, colorClass: "text-emerald-400" },
                { label: "Sugar", value: `${Math.round(todaySugar)}g`, colorClass: "text-rose-400" },
                { label: "Sodium", value: `${Math.round(todaySodiumMg / 100) / 10}g`, colorClass: "text-cyan-400" },
                { label: "Servings", value: `${Math.round(todayServings * 10) / 10}`, colorClass: "text-violet-400" },
              ].map(({ label, value, colorClass }) => (
                <div key={label} className="text-center">
                  <p className={cn("tabular-nums text-[14px] font-black leading-none", colorClass)}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Set your daily calorie goal to track nutrition here.
            </p>
            <Link href="/nutrition/goals">
              <Button variant="outline" size="sm">Set Goals</Button>
            </Link>
          </div>
        )}
      </div>
    </SectionCard>
  );

  const cardMap: Record<string, React.ReactNode> = {
    launcher: <SmartLauncherWidget key="launcher" />,
    fatigue: <FatigueLevelCard key="fatigue" initialSnapshot={fatigueSnapshot} />,
    muscleRecovery: <MuscleRecoveryCard key="muscleRecovery" />,
    weight: <WeightLogWidget key="weight" />,
    ninetyDay: ninetyDayCard,
    nutrition: nutritionCard,
  };

  const orderedCards = useDashboardPhase(dashboardPhase, cardMap);

  return (
    <div data-phase={dashboardPhase} className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-5 md:px-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl glass-surface-elevated glass-highlight p-6 sm:p-8"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-[80px]" />
        <div className="pointer-events-none absolute -left-16 -bottom-12 h-64 w-64 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 -top-6 h-32 w-96 -translate-x-1/2 bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.10))] blur-2xl" />

        <div className="relative space-y-6">
          {/* Header row */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              {/* Date pill + Level badge */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Date pill with live dot */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{
                      boxShadow: "0 0 6px rgb(52 211 153)",
                      animation: "pulse 2s infinite",
                    }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {todayFormatted}
                  </span>
                </div>
                {/* XP progress bar */}
                <XpProgressBar level={level} xp={xp} />
                {/* Weekly Review */}
                <WeeklyReviewModal
                  streak={streak}
                  weeklySessionCount={thisWeekSessionCount}
                  weeklyMomentumGoal={weeklyMomentumGoal}
                  weeklyProgressPct={weeklyProgressPct}
                  weeklyAverageSessions={weeklyAverageSessions}
                  projectedSessions90d={projectedSessions90d}
                  projectedVolumeKg={projectedVolumeKg}
                  totalSessions={totalSessionCount}
                  unitLabel={unitLabel}
                  toDisplayVolume={toDisplayVolume}
                />
              </div>

              {/* Heading */}
              <div>
                <h1
                  className="font-black leading-[1.1] tracking-tight text-foreground"
                  style={{ fontSize: "clamp(24px, 5vw, 40px)" }}
                >
                  {workedOutToday ? (
                    <>
                      Performance locked,{" "}
                      <span className="text-primary">{displayName}</span>
                    </>
                  ) : (
                    <>
                      Build momentum,{" "}
                      <span className="text-primary">{displayName}</span>
                    </>
                  )}
                </h1>
                <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-muted-foreground">
                  {workedOutToday
                    ? "Session complete. Keep the edge by recovering and logging nutrition precisely."
                    : "Your next session defines the week. Start now and protect your streak."}
                </p>
              </div>
            </div>

            {/* Streak section */}
            <StreakSection
              userId={userId}
              currentStreak={streak}
              milestonesUnlocked={milestonesUnlocked}
              freezeAvailable={freezeAvailable}
              level={level}
            />
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3">
            <StatPill
              icon={<Flame className="h-4 w-4 text-orange-500" />}
              value={streak}
              label="Day Streak"
            />
            <StatPill
              icon={<Dumbbell className="h-4 w-4 text-primary" />}
              value={thisWeekSessionCount}
              label="This Week"
            />
            <StatPill
              icon={<Trophy className="h-4 w-4 text-amber-400" />}
              value={totalSessionCount}
              label="Total"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Link href="/workout">
              <Button className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-bold sm:gap-2 sm:text-sm">
                <Play className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Workout</span>
              </Button>
            </Link>
            <Link href="/nutrition">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-semibold sm:gap-2 sm:text-sm"
              >
                <Apple className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Nutrition</span>
              </Button>
            </Link>
            <Link href="/history/progress">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-semibold sm:gap-2 sm:text-sm"
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Progress</span>
              </Button>
            </Link>
          </div>


        </div>
      </motion.section>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">

        {/* Left column – phase-ordered cards */}
        <motion.div
          className="space-y-5"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
        >
          {orderedCards.map((card, i) => (
            <motion.div key={i} variants={glassMotionVariants.glassReveal}>
              {card}
            </motion.div>
          ))}

          {/* Last Workout */}
          <SectionCard>
            <DashboardCardHeader
              icon={<CalendarDays className="h-3.5 w-3.5 text-primary" />}
              title="Last Workout"
              action={
                <Link href="/history">
                  <button className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-opacity hover:opacity-80">
                    View all
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              }
            />
            <CardDivider />
            <div className="p-5">
              {lastWorkout ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-[15px] font-black text-foreground">{lastWorkout.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(lastWorkout.started_at)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400">
                      Completed
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          Duration
                        </span>
                      </div>
                      <span className="tabular-nums text-[20px] font-black leading-none text-foreground">
                        {formatDuration(lastWorkout.duration_seconds)}
                      </span>
                    </div>

                    {lastWorkout.total_volume_kg && (
                      <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                            Volume
                          </span>
                        </div>
                        <span className="tabular-nums text-[20px] font-black leading-none text-foreground">
                          {toDisplayVolume(lastWorkout.total_volume_kg).toLocaleString()}
                          <span className="text-[12px] font-normal text-muted-foreground"> {unitLabel}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No workouts yet. Start your first session.
                  </p>
                  <Link href="/workout">
                    <Button size="sm">
                      <Dumbbell className="mr-2 h-4 w-4" />
                      Start Workout
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </SectionCard>


        </motion.div>

        {/* Right aside */}
        <aside className="space-y-5">
          <PodsDashboardCard />

        </aside>
      </div>
    </div>
  );
}
```

---
## src/components/dashboard/fatigue-level-card.tsx
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FatigueSnapshot } from "@/lib/fatigue/types";

type Props = {
  initialSnapshot: FatigueSnapshot;
};

function meterTone(value: number): string {
  if (value >= 85) return "text-rose-400";
  if (value >= 70) return "text-orange-400";
  if (value >= 50) return "text-amber-400";
  return "text-emerald-400";
}

export function FatigueLevelCard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<FatigueSnapshot>(initialSnapshot);
  const [saving, setSaving] = useState(false);
  const [checkin, setCheckin] = useState({
    sleep_quality: 7,
    soreness: 3,
    stress: 3,
    motivation: 8,
  });

  // Use snapshot timezone from the server to avoid hydration mismatch
  // (Intl.DateTimeFormat().resolvedOptions().timeZone differs on server vs client)
  const timezone = snapshot.timezone || "UTC";

  async function handleSubmitCheckin() {
    setSaving(true);
    try {
      const response = await fetch("/api/fatigue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checkin, timezone }),
      });

      if (!response.ok) {
        throw new Error("Could not save check-in");
      }

      const data = await response.json();
      if (data?.snapshot) {
        setSnapshot(data.snapshot as FatigueSnapshot);
      }
      toast.success("Recovery check-in saved.");
    } catch (error) {
      console.error("Check-in save failed:", error);
      toast.error("Failed to save check-in");
    } finally {
      setSaving(false);
    }
  }

  const contributors = [
    {
      key: "load",
      label: "Load",
      value: snapshot.loadSubscore,
      help: "sRPE × duration vs your rolling 7/28 day training load.",
    },
    {
      key: "recovery",
      label: "Recovery",
      value: snapshot.recoverySubscore,
      help: "Sleep, soreness, stress, and motivation from your daily check-in.",
    },
    {
      key: "performance",
      label: "Performance",
      value: snapshot.performanceSubscore,
      help: "Recent performance trend on trained compound lifts at similar effort when available.",
    },
  ] as const;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Fatigue Level
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                Why?
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-xs text-muted-foreground">
              Estimate based on training load, recent performance trends, and recovery check-ins.
              Improves with consistent logging.
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="flex items-end justify-between">
            <p className="text-4xl font-black leading-none tabular-nums">{snapshot.fatigueScore}</p>
            <p className={`text-sm font-semibold ${meterTone(snapshot.fatigueScore)}`}>
              {snapshot.recommendation.label}
            </p>
          </div>
          <Progress value={snapshot.fatigueScore} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{snapshot.recommendation.guidance}</p>
        </div>

        <div className="space-y-2">
          {contributors.map((item) => (
            <div key={item.key} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium">{item.label}</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      {item.value}
                      <CircleHelp className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-xs text-muted-foreground">{item.help}</PopoverContent>
                </Popover>
              </div>
              <Progress value={item.value} className="h-1.5" />
            </div>
          ))}
        </div>

        {!snapshot.hasRecentSessions ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            No recent sessions logged. <Link href="/workout" className="underline">Log a workout</Link> to improve this estimate.
          </div>
        ) : null}

        {snapshot.needsSessionRpe ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Missing session RPE on recent workouts. Add post-session effort ratings for better load accuracy.
          </div>
        ) : null}

        {!snapshot.hasRecoveryCheckin ? (
          <div className="rounded-xl border border-border/60 bg-card/30 p-3 space-y-3">
            <p className="text-xs font-semibold">Quick check-in (today)</p>
            {([
              ["sleep_quality", "Sleep quality"],
              ["soreness", "Soreness"],
              ["stress", "Stress"],
              ["motivation", "Motivation"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">{checkin[field]}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[checkin[field]]}
                  onValueChange={(value) => {
                    setCheckin((prev) => ({ ...prev, [field]: value[0] ?? prev[field] }));
                  }}
                />
              </div>
            ))}
            <Button className="w-full" onClick={handleSubmitCheckin} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Check-in
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

---
## src/components/dashboard/level-up-celebration.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    // Stage 1: Radial burst confetti
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FFA500", "#FF6B9D", "#C471ED"],
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Show card after 300ms
    setTimeout(() => {
      setShowCard(true);
    }, 300);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:items-center sm:p-6">
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-sm"
          >
            <Card className="relative max-h-[min(92dvh,42rem)] overflow-y-auto overflow-x-clip rounded-3xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-2xl">
              {/* Animated Background Glow */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{
                  opacity: [0.35, 0.75, 0.35],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Corner glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={onClose}
                aria-label="Close level-up celebration"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Content */}
              <div className="relative text-center space-y-4">
                {/* Level Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-10 w-10 text-primary-foreground" />
                    {[0, 120, 240].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-full w-full"
                        animate={{ rotate: [deg, deg + 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                      >
                        <Star className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-primary" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                    Level Up!
                  </h2>
                  <p className="mt-1 text-3xl font-black tracking-tight">
                    You reached
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New level unlocked.
                  </p>
                </motion.div>

                {/* Level Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                  className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/20 to-accent/20 p-6"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text-7xl font-black tabular-nums text-primary">
                      {newLevel}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Level
                    </span>
                  </div>
                </motion.div>

                {/* Motivational Message */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  You&apos;re getting stronger. Keep stacking sessions.
                </motion.p>

                {/* Continue Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={onClose}
                    className="motion-press w-full rounded-xl"
                    size="lg"
                  >
                    Continue Training
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## src/components/dashboard/macro-bar.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  value: number;
  goal: number | null;
  textColorClass: string;
  barColorClass: string;
  trackHeight?: string;
}

export const MacroBar = React.memo(function MacroBar({
  label,
  value,
  goal,
  textColorClass,
  barColorClass,
  trackHeight = "h-1",
}: MacroBarProps) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums text-xs font-bold", textColorClass)}>
          {Math.round(value)}g
          {goal && (
            <span className="font-normal text-muted-foreground"> / {goal}g</span>
          )}
        </span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-[var(--glass-tint-medium)]", trackHeight)}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            barColorClass,
            pct > 80 && "shadow-[0_0_8px_currentColor/30]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});
```

---
## src/components/dashboard/momentum-protection-card.tsx
```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock3, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import {
  logRetentionEvent,
  trackComebackPlanCompleted,
  trackComebackPlanStarted,
} from "@/lib/retention-events";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MomentumProtectionCardProps {
  userId: string;
  urgency: "low" | "medium" | "high";
  workedOutYesterday: boolean;
  freezeAvailable: boolean;
}

export function MomentumProtectionCard({
  userId,
  urgency,
  workedOutYesterday,
  freezeAvailable,
}: MomentumProtectionCardProps) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `retention:momentum_protection_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(dedupeKey, "1");
    }

    void logRetentionEvent(supabase, {
      userId,
      eventType: "momentum_protection_shown",
      sourceScreen: "dashboard",
      metadata: {
        urgency,
        worked_out_yesterday: workedOutYesterday,
        freeze_available: freezeAvailable,
      },
    });
  }, [freezeAvailable, supabase, urgency, userId, workedOutYesterday]);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });
      if (error) throw error;

      if (data === true) {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_used",
          sourceScreen: "dashboard",
          metadata: { urgency },
        });
        void trackComebackPlanCompleted(supabase, userId, {
          channel: "streak_freeze",
          urgency,
        });
        toast.success("Streak freeze activated. Momentum protected for today.");
        router.refresh();
      } else {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_failed",
          sourceScreen: "dashboard",
          metadata: { reason: "not_available", urgency },
        });
        toast.error("No streak freeze available.");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      void logRetentionEvent(supabase, {
        userId,
        eventType: "streak_freeze_failed",
        sourceScreen: "dashboard",
        metadata: { reason: "rpc_error", urgency },
      });
      toast.error("Failed to activate streak freeze.");
    }
  }

  return (
    <Card
      className={`border ${
        urgency === "high"
          ? "border-rose-500/50 bg-rose-500/10"
          : urgency === "medium"
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-primary/40 bg-primary/10"
      }`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Momentum Protection
          </p>
          <p className="mt-1 text-sm font-semibold">
            {urgency === "high"
              ? "Your streak is at risk tonight."
              : workedOutYesterday
                ? "Keep the streak alive with one focused session."
                : "A quick session today restores momentum."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {urgency === "high"
              ? "Log a workout now to avoid losing your current run."
              : "You are closer than you think. Protect the momentum."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {urgency === "high" ? (
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          ) : (
            <Clock3 className="h-4 w-4 text-amber-400" />
          )}
          {freezeAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={handleUseFreeze}
            >
              <Snowflake className="mr-1.5 h-3.5 w-3.5" />
              Use Freeze
            </Button>
          ) : (
            <Link href="/workout">
              <Button
                size="sm"
                className="motion-press h-8 rounded-lg px-3 text-xs"
                onClick={() => {
                  void trackComebackPlanStarted(supabase, userId, {
                    channel: "start_workout",
                    urgency,
                  });
                }}
              >
                Protect
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## src/components/dashboard/muscle-recovery-card.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MuscleGroupRecovery,
  RecoveryStatus,
} from "@/lib/fatigue/muscle-group";
import {
  recoveryColor,
  recoveryBarColor,
} from "@/lib/fatigue/muscle-group";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(hours: number | null): string {
  if (hours == null) return "--";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function statusLabel(status: RecoveryStatus): string {
  switch (status) {
    case "recovered":
      return "Recovered";
    case "recovering":
      return "Recovering";
    case "fatigued":
      return "Fatigued";
    case "untrained":
      return "Untrained";
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
      <div className="flex-1">
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
      </div>
      <div className="h-3 w-8 animate-pulse rounded bg-muted/40" />
    </div>
  );
}

// ─── MuscleRecoveryCard ───────────────────────────────────────────────────────

export function MuscleRecoveryCard() {
  const [recoveries, setRecoveries] = useState<MuscleGroupRecovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/fatigue/muscle-groups");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) {
          setRecoveries(json.recoveries ?? []);
        }
      } catch {
        if (!cancelled) setError("Could not load recovery data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden glass-surface glass-highlight rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-[13px] font-bold text-foreground">
            Muscle Recovery
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            {error}
          </div>
        ) : recoveries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-4 text-center text-xs text-muted-foreground">
            No recent workout data. Complete a session to see per-muscle recovery
            status.
          </div>
        ) : (
          <div className="space-y-1">
            {recoveries.map((r) => (
              <div
                key={r.muscleGroup}
                className="flex items-center gap-3 rounded-xl border border-[var(--glass-border-light)] bg-[var(--glass-tint-light)] px-4 py-2.5"
              >
                {/* Muscle name */}
                <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {r.displayName}
                </span>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-tint-medium)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        recoveryBarColor(r.recoveryStatus),
                        r.recoveryStatus === "recovered" && "shadow-[0_0_6px_oklch(0.72_0.18_145_/_0.4)]",
                        r.recoveryStatus === "recovering" && "shadow-[0_0_6px_oklch(0.80_0.15_85_/_0.4)]",
                        r.recoveryStatus === "fatigued" && "shadow-[0_0_6px_oklch(0.65_0.22_25_/_0.4)]",
                      )}
                      style={{ width: `${r.recoveryPct}%` }}
                    />
                  </div>
                </div>

                {/* Recovery percentage */}
                <span
                  className={cn(
                    "w-9 text-right tabular-nums text-[11px] font-bold",
                    recoveryColor(r.recoveryStatus)
                  )}
                >
                  {r.recoveryPct}%
                </span>

                {/* Time since trained */}
                <div className="flex w-10 items-center justify-end gap-0.5 text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="tabular-nums text-[10px] font-medium">
                    {formatTimeSince(r.hoursSinceTrained)}
                  </span>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-1 pt-2">
              {(
                [
                  ["Fatigued", "bg-rose-400"],
                  ["Recovering", "bg-amber-400"],
                  ["Recovered", "bg-emerald-400"],
                ] as const
              ).map(([label, dot]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---
## src/components/dashboard/pro-upgrade-card.tsx
```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Sparkles, LineChart, ShieldCheck } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProUpgradeCardProps {
  userId: string;
}

export function ProUpgradeCard({ userId }: ProUpgradeCardProps) {
  const supabase = useSupabase();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `conversion:pro_upgrade_card:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    supabase.from("conversion_impressions").insert({
      user_id: userId,
      placement: "dashboard",
      impression_type: "locked_preview",
      variant: "pro_card_v1",
      metadata: {
        module: "analytics_and_coaching",
      },
    }).then(({ error }) => {
      if (error) console.warn("[pro-upgrade-card] impression tracking failed:", error.message);
    });
  }, [supabase, userId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card/85">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Pro Performance Layer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ve built momentum. Unlock coaching-grade trend models and pod competition analytics.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span>Advanced PR trajectory forecasting</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Accountability pod pressure index</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Adaptive fueling recommendations</span>
          </div>
        </div>
        <Link href="/upgrade" className="block">
          <Button className="motion-press w-full" size="sm">
            View Pro Features
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

---
## src/components/dashboard/protein-ring.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface ProteinRingProps {
  consumed: number;
  goal: number;
}

export const ProteinRing = React.memo(function ProteinRing({ consumed, goal }: ProteinRingProps) {
  const R = 30;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <filter id="protein-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="38" cy="38" r={R} strokeWidth="5" fill="none" className="stroke-border" />
        {/* Glow layer */}
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#protein-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="5"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="tabular-nums text-[16px] font-black leading-none text-blue-400">
          {Math.round(consumed)}
        </span>
        <span className="text-[8px] font-semibold text-muted-foreground">
          {isOver ? "over" : "left"}
        </span>
        <span className={cn("tabular-nums text-[8px] font-bold", isOver ? "text-rose-400" : "text-blue-400")}>
          {Math.round(isOver ? consumed - goal : remaining)}g
        </span>
      </div>
    </div>
  );
});
```

---
## src/components/dashboard/section-card.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = React.memo(function SectionCard({ children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden glass-surface glass-highlight rounded-2xl",
        className
      )}
    >
      {children}
    </div>
  );
});
```

---
## src/components/dashboard/stat-pill.tsx
```tsx
import React from "react";

interface StatPillProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}

export const StatPill = React.memo(function StatPill({ icon, value, label }: StatPillProps) {
  return (
    <div className="flex flex-col items-center justify-center glass-surface glass-highlight rounded-2xl px-2 py-4 text-center sm:px-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[22px] font-black leading-none text-foreground sm:text-[26px]">
        {value}
      </span>
      <span className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[9px]">
        {label}
      </span>
    </div>
  );
});
```

---
## src/components/dashboard/streak-badge.tsx
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface StreakBadgeProps {
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  onUseFreeze?: () => void;
  className?: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  7: "Week Warrior",
  30: "Monthly Master",
  100: "Centurion",
  365: "Year Champion",
};

const MILESTONE_COLORS: Record<number, string> = {
  7: "from-yellow-500/20 to-amber-500/20 border-yellow-400/30 text-yellow-400",
  30: "from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400",
  100: "from-purple-500/20 to-pink-500/20 border-purple-400/30 text-purple-400",
  365: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-400",
};

export function StreakBadge({
  currentStreak,
  milestonesUnlocked = [],
  freezeAvailable,
  onUseFreeze,
  className,
}: StreakBadgeProps) {
  const [showMilestoneNotification, setShowMilestoneNotification] = useState<number | null>(null);
  const previousMilestonesRef = useRef<number[]>(milestonesUnlocked);

  // Detect new milestone unlocks
  useEffect(() => {
    const newMilestones = milestonesUnlocked.filter(
      (m) => !previousMilestonesRef.current.includes(m)
    );

    if (newMilestones.length > 0) {
      const latestMilestone = Math.max(...newMilestones);
      queueMicrotask(() => {
        setShowMilestoneNotification(latestMilestone);
      });

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setShowMilestoneNotification(null);
      }, 5000);
    }
    previousMilestonesRef.current = milestonesUnlocked;
  }, [milestonesUnlocked]);

  const nextMilestone = [7, 30, 100, 365].find((m) => m > currentStreak) ?? null;
  const daysToNext = nextMilestone ? nextMilestone - currentStreak : null;

  return (
    <div className={cn("relative", className)}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4 space-y-3">
          {/* Streak Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={currentStreak > 0 ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0],
                } : {}}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Flame className="h-6 w-6 text-orange-500" />
              </motion.div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {currentStreak}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">day streak</span>
                </p>
                {daysToNext && (
                  <p className="text-xs text-muted-foreground">
                    {daysToNext} days until {MILESTONE_LABELS[nextMilestone!]}
                  </p>
                )}
              </div>
            </div>

            {/* Freeze Badge */}
            {freezeAvailable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onUseFreeze}
                className="gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                title="Use streak freeze (1x/month)"
              >
                <Snowflake className="h-3 w-3" />
                Freeze
              </Button>
            )}
          </div>

          {/* Milestones Grid */}
          {milestonesUnlocked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[7, 30, 100, 365].map((milestone) => {
                const isUnlocked = milestonesUnlocked.includes(milestone);
                return (
                  <motion.div
                    key={milestone}
                    initial={isUnlocked ? { scale: 0 } : false}
                    animate={isUnlocked ? { scale: 1 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-[10px] font-semibold transition-all",
                        isUnlocked
                          ? `bg-gradient-to-r ${MILESTONE_COLORS[milestone]}`
                          : "border-muted-foreground/30 bg-muted/20 text-muted-foreground opacity-50"
                      )}
                    >
                      {isUnlocked && <Trophy className="h-2.5 w-2.5" />}
                      {milestone}d
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Unlock Notification */}
      <AnimatePresence>
        {showMilestoneNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-10"
          >
            <Card className={cn(
              "border-2 bg-gradient-to-r shadow-lg",
              MILESTONE_COLORS[showMilestoneNotification]
            )}>
              <CardContent className="p-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <div className="text-sm font-semibold">
                  <p>{MILESTONE_LABELS[showMilestoneNotification]} Unlocked!</p>
                  <p className="text-xs opacity-80">{showMilestoneNotification}-day streak</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## src/components/dashboard/streak-section.tsx
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StreakBadge } from "./streak-badge";
import { LevelUpCelebration } from "./level-up-celebration";
import { useSupabase } from "@/hooks/use-supabase";
import { toast } from "sonner";

interface StreakSectionProps {
  userId: string;
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  level: number;
}

export function StreakSection({
  userId,
  currentStreak,
  milestonesUnlocked,
  freezeAvailable,
  level,
}: StreakSectionProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [showLevelUp, setShowLevelUp] = useState(false);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });

      if (error) throw error;

      if (data) {
        toast.success("Streak freeze activated! Your streak is protected for today.");
        router.refresh();
      } else {
        toast.error("No streak freeze available");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      toast.error("Failed to activate streak freeze");
    }
  }

  return (
    <>
      <StreakBadge
        currentStreak={currentStreak}
        milestonesUnlocked={milestonesUnlocked}
        freezeAvailable={freezeAvailable}
        onUseFreeze={handleUseFreeze}
        className="mt-1"
      />

      {showLevelUp && (
        <LevelUpCelebration
          newLevel={level}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </>
  );
}
```

---
## src/components/dashboard/weekly-review-modal.tsx
```tsx
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
```

---
## src/components/dashboard/weight-log-widget.tsx
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Scale, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, lbsToKg, weightUnit } from "@/lib/units";

type WeightLog = {
  logged_date: string;
  weight_kg: number;
};

export function WeightLogWidget() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [latest, setLatest] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchLatest = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=1");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLatest(data[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLatest();
    useUnitPreferenceStore.persist.rehydrate();
  }, [fetchLatest]);

  const displayWeight = (kg: number) =>
    `${weightToDisplay(kg, isImperial, 1)} ${weightUnit(isImperial)}`;

  const handleSave = async () => {
    const val = parseFloat(input);
    if (!input || isNaN(val) || val <= 0) return;
    setSaving(true);
    const weight_kg = isImperial ? lbsToKg(val) : val;
    // Use Intl to get today in the user's local timezone (avoids server/client date mismatch)
    const today = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const res = await fetch("/api/body/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logged_date: today, weight_kg }),
    });
    if (res.ok) {
      const data: WeightLog = await res.json();
      setLatest(data);
      setInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-bold">Body Weight</span>
        </div>
        <Link
          href="/body"
          className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          History <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-end gap-3">
        {latest ? (
          <div className="flex-1">
            <p className="text-[26px] font-black leading-none tabular-nums">
              {displayWeight(latest.weight_kg)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Last logged {format(new Date(`${latest.logged_date}T12:00:00`), "MMM d")}
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">No weight logged yet</p>
          </div>
        )}

        {/* Quick log */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder={isImperial ? "165" : "75"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSave()}
            className="h-8 w-20 rounded-lg border border-border/50 bg-background/60 px-2.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving || !input}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[11px] font-bold">{unitLabel}</span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

