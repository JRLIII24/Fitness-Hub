"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronRight,
  Clock,
  Dumbbell,
  Layers,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMuscleColor } from "@/lib/muscle-colors";
import type { PlanExercise, WorkoutPlan } from "@/types/workout";

interface WorkoutPlanCardProps {
  plan: WorkoutPlan;
  onConfirm: (finalPlan: WorkoutPlan) => void;
  onBack: () => void;
  onSwapExercise: (index: number) => void;
  onNameChange: (name: string) => void;
}

const MAX_VISIBLE = 8;

export function WorkoutPlanCard({
  plan,
  onConfirm,
  onBack,
  onSwapExercise,
  onNameChange,
}: WorkoutPlanCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const totalSets = plan.exercises.reduce((s, e) => s + e.targetSets, 0);
  const visibleExercises = showAll
    ? plan.exercises
    : plan.exercises.slice(0, MAX_VISIBLE);
  const hiddenCount = plan.exercises.length - MAX_VISIBLE;

  const sourceLabel =
    plan.source === "template"
      ? "From Template"
      : plan.source === "preset"
        ? `Preset`
        : "Custom";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Main card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-4">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-1 inline-block rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                {sourceLabel}
              </span>
              {editingName ? (
                <Input
                  autoFocus
                  value={plan.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                  className="mt-1 h-8 border-primary/30 bg-transparent text-lg font-black"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="mt-1 flex items-center gap-1.5 text-left"
                >
                  <h2 className="text-lg font-black leading-tight text-foreground line-clamp-1">
                    {plan.name}
                  </h2>
                  <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <StatCell
              icon={<Dumbbell className="h-3.5 w-3.5 text-primary" />}
              value={plan.exercises.length}
              label="Exercises"
            />
            <StatCell
              icon={<Layers className="h-3.5 w-3.5 text-primary" />}
              value={totalSets}
              label="Total Sets"
            />
            <StatCell
              icon={<Clock className="h-3.5 w-3.5 text-primary" />}
              value={`~${plan.estimatedDurationMin}`}
              label="Minutes"
            />
          </div>

          {/* Muscle groups */}
          {plan.muscleGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plan.muscleGroups.map((mg) => {
                const mc = getMuscleColor(mg);
                return (
                  <span
                    key={mg}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize"
                    style={{
                      background: mc.bgAlpha,
                      border: `1px solid ${mc.borderAlpha}`,
                      color: mc.labelColor,
                    }}
                  >
                    {mg}
                  </span>
                );
              })}
            </div>
          )}

          {/* Exercise list */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Exercises
            </p>
            <AnimatePresence initial={false}>
              {visibleExercises.map((pe, i) => (
                <ExerciseRow
                  key={`${pe.exercise.id}-${i}`}
                  planExercise={pe}
                  index={i}
                  onSwap={() => onSwapExercise(i)}
                />
              ))}
            </AnimatePresence>

            {hiddenCount > 0 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full rounded-xl border border-border/40 bg-card/20 py-2 text-[11px] font-semibold text-muted-foreground transition hover:bg-card/40"
              >
                +{hiddenCount} more exercises
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          size="lg"
          onClick={() => onConfirm(plan)}
          className="flex-1 gap-1.5 rounded-xl text-base font-semibold"
        >
          Start Workout
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-card/40 py-2.5">
      {icon}
      <span className="tabular-nums text-xl font-black leading-none text-foreground">
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ExerciseRow({
  planExercise,
  index,
  onSwap,
}: {
  planExercise: PlanExercise;
  index: number;
  onSwap: () => void;
}) {
  const mc = getMuscleColor(planExercise.muscleGroup);
  const repsDisplay = planExercise.targetReps ?? "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5"
    >
      {/* Exercise info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-foreground">
          {planExercise.exercise.name}
        </p>
        <span
          className="mt-0.5 inline-block rounded-full px-1.5 py-px text-[9px] font-semibold capitalize"
          style={{
            background: mc.bgAlpha,
            color: mc.labelColor,
            border: `1px solid ${mc.borderAlpha}`,
          }}
        >
          {planExercise.muscleGroup}
        </span>
      </div>

      {/* Sets × Reps pill */}
      <span className="shrink-0 rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-[11px] font-bold tabular-nums text-foreground">
        {planExercise.targetSets}×{repsDisplay}
      </span>

      {/* Swap button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={onSwap}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/30 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
        aria-label={`Swap ${planExercise.exercise.name}`}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </motion.button>
    </motion.div>
  );
}
