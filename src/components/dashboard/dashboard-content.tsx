"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { glassMotionVariants } from "@/lib/motion";

import {
  Dumbbell,
  Apple,
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
import { ReadinessScoreCard } from "@/components/dashboard/readiness-score-card";
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
  return <div className="glass-divider" />;
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
            <span className="font-display tabular-nums text-[40px] font-black leading-none text-primary">
              {projectedSessions90d}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">
              workouts in 90 days
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl glass-inner px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              7-Day Goal
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display tabular-nums text-[22px] font-black leading-none text-[#F0F4FF]">
                {thisWeekSessionCount}
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">
                /{weeklyMomentumGoal}
              </span>
            </div>
          </div>
          <div className="rounded-xl glass-inner px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              Proj. Volume
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display tabular-nums text-[18px] font-black leading-none text-[#F0F4FF]">
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
          <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
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
        icon={<Apple className="h-3.5 w-3.5 text-[var(--status-positive)]" />}
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
                  <p className="font-display tabular-nums text-[20px] font-black leading-none text-[#F0F4FF]">
                    {calorieGoal.toLocaleString()}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {" "}kcal
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--status-positive)]/20 bg-[var(--status-positive)]/10 px-3 py-2">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Remaining</p>
                  <p className="tabular-nums text-[18px] font-black leading-none text-[var(--status-positive)]">
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
                textColorClass="text-[var(--macro-protein)]"
                barColorClass="bg-[var(--macro-protein)]"
                trackHeight="h-2"
              />
              <MacroBar
                label="Carbs"
                value={todayCarbs}
                goal={nutritionGoal?.carbs_g_target ?? null}
                textColorClass="text-[var(--macro-carbs)]"
                barColorClass="bg-[var(--macro-carbs)]"
              />
              <MacroBar
                label="Fat"
                value={todayFat}
                goal={nutritionGoal?.fat_g_target ?? null}
                textColorClass="text-[var(--macro-fat)]"
                barColorClass="bg-[var(--macro-fat)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl glass-inner p-3 sm:grid-cols-4">
              {[
                { label: "Fiber", value: `${Math.round(todayFiber)}g`, colorClass: "text-[var(--macro-fiber)]" },
                { label: "Sugar", value: `${Math.round(todaySugar)}g`, colorClass: "text-[var(--macro-carbs)]" },
                { label: "Sodium", value: `${Math.round(todaySodiumMg / 100) / 10}g`, colorClass: "text-[var(--status-neutral)]" },
                { label: "Servings", value: `${Math.round(todayServings * 10) / 10}`, colorClass: "text-[var(--status-neutral)]" },
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
    recovery: <ReadinessScoreCard key="recovery" />,
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
        className="relative overflow-hidden rounded-3xl glass-surface-elevated p-6 sm:p-8"
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
                <div className="inline-flex items-center gap-2 rounded-full glass-chip px-3 py-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-positive)]"
                    style={{
                      boxShadow: "0 0 6px var(--status-positive)",
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
                  className="font-display font-black leading-[1.1] tracking-tight text-[#F0F4FF]"
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
                <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-[#94A3B8]">
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
          <div className="grid grid-cols-2 gap-3">
            <StatPill
              icon={<Trophy className="h-4 w-4 text-primary" />}
              value={totalSessionCount}
              label="Total Sessions"
            />
            <StatPill
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              value={lastWorkout?.total_volume_kg ? toDisplayVolume(lastWorkout.total_volume_kg).toLocaleString() : "—"}
              label={`Volume (${unitLabel})`}
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
                    <span className="whitespace-nowrap rounded-full border border-[var(--status-positive)]/30 bg-[var(--status-positive)]/15 px-2.5 py-0.5 text-[9px] font-bold text-[var(--status-positive)]">
                      Completed
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 rounded-xl glass-inner px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5 text-[#94A3B8]" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
                          Duration
                        </span>
                      </div>
                      <span className="font-display tabular-nums text-[20px] font-black leading-none text-[#F0F4FF]">
                        {formatDuration(lastWorkout.duration_seconds)}
                      </span>
                    </div>

                    {lastWorkout.total_volume_kg && (
                      <div className="flex flex-col gap-0.5 rounded-xl glass-inner px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="h-2.5 w-2.5 text-[#94A3B8]" />
                          <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
                            Volume
                          </span>
                        </div>
                        <span className="font-display tabular-nums text-[20px] font-black leading-none text-[#F0F4FF]">
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
