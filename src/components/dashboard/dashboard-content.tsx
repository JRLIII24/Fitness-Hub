"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

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

import { SmartLauncherWidget } from "@/components/workout/smart-launcher-widget";
import { FatigueLevelCard } from "@/components/dashboard/fatigue-level-card";
import { PodsDashboardCard } from "@/components/pods/pods-dashboard-card";
import { XpProgressBar } from "@/components/profile/xp-progress-bar";


import type { FatigueSnapshot } from "@/lib/fatigue/types";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  sessions: SessionRow[];
  thisWeekSessions: SessionRow[];
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

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-3 py-4 text-center">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[26px] font-black leading-none text-foreground">
        {value}
      </span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  label,
  value,
  goal,
  textColorClass,
  barColorClass,
}: {
  label: string;
  value: number;
  goal: number | null;
  textColorClass: string;
  barColorClass: string;
}) {
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
      <div className="h-1 overflow-hidden rounded-full bg-border/40">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── CalorieRing ──────────────────────────────────────────────────────────────

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
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
        {/* Track */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          className="stroke-border"
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
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card/30",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── DashboardCardHeader ──────────────────────────────────────────────────────

function DashboardCardHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card/70">
          {icon}
        </div>
        <span className="text-[13px] font-bold text-foreground">{title}</span>
      </div>
      {action}
    </div>
  );
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
  sessions,
  thisWeekSessions,
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
}: DashboardContentProps) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const toDisplayVolume = (kgVolume: number) =>
    preference === "imperial"
      ? Math.round(kgVolume * 2.20462)
      : Math.round(kgVolume);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-5 md:px-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-6 sm:p-8"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-[80px]" />
        <div className="pointer-events-none absolute -left-16 -bottom-12 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 -top-6 h-32 w-96 -translate-x-1/2 bg-primary/10 blur-2xl" />

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
              value={thisWeekSessions.length}
              label="This Week"
            />
            <StatPill
              icon={<Trophy className="h-4 w-4 text-amber-400" />}
              value={sessions.length}
              label="Total"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Link href="/workout">
              <Button className="motion-press h-12 w-full justify-center gap-2 rounded-xl text-xs font-bold sm:text-sm">
                <Play className="h-3.5 w-3.5" />
                Start Workout
              </Button>
            </Link>
            <Link href="/nutrition">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-2 rounded-xl text-xs font-semibold sm:text-sm"
              >
                <Apple className="h-3.5 w-3.5" />
                Log Nutrition
              </Button>
            </Link>
            <Link href="/history/progress">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-2 rounded-xl text-xs font-semibold sm:text-sm"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Progress
              </Button>
            </Link>
          </div>


        </div>
      </motion.section>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">

        {/* Left column */}
        <div className="space-y-5">
          <SmartLauncherWidget />
          <FatigueLevelCard initialSnapshot={fatigueSnapshot} />

          {/* 90-Day Path */}
          <SectionCard>
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
              {/* Projection headline */}
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

              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                    7-Day Goal
                  </p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
                      {thisWeekSessions.length}
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

              {/* Animated progress bar */}
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



          {/* Nutrition */}
          <SectionCard>
            <DashboardCardHeader
              icon={<Apple className="h-3.5 w-3.5 text-emerald-400" />}
              title="Today's Nutrition"
              action={
                <Link href="/nutrition">
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-opacity hover:opacity-80">
                    Log food
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </Link>
              }
            />
            <CardDivider />
            <div className="space-y-5 p-5">
              {calorieGoal ? (
                <>
                  {/* Calorie ring + remaining */}
                  <div className="flex items-center gap-5">
                    <CalorieRing consumed={todayCalories} goal={calorieGoal} />
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

                  {/* Macro bars */}
                  <div className="space-y-3">
                    <MacroBar
                      label="Protein"
                      value={todayProtein}
                      goal={nutritionGoal?.protein_g_target ?? null}
                      textColorClass="text-blue-400"
                      barColorClass="bg-blue-400"
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

                  {/* Micro nutrients */}
                  <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/50 bg-card/30 p-3">
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

          {/* Last Workout */}
          <SectionCard>
            <DashboardCardHeader
              icon={<CalendarDays className="h-3.5 w-3.5 text-primary" />}
              title="Last Workout"
              action={
                <Link href="/history">
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-opacity hover:opacity-80">
                    View all
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </Link>
              }
            />
            <CardDivider />
            <div className="p-5">
              {lastWorkout ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[15px] font-black text-foreground">{lastWorkout.name}</p>
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


        </div>

        {/* Right aside */}
        <aside className="space-y-5">
          <PodsDashboardCard />

        </aside>
      </div>
    </div>
  );
}
