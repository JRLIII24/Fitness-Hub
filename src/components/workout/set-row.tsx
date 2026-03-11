"use client";

import { memo } from "react";
import { ArrowUp, Check, Equal, Flame, Ghost, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkoutSet } from "@/types/workout";
import type { OverloadSuggestion } from "@/lib/progressive-overload";
import { cn } from "@/lib/utils";
import { REST_PRESETS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { KG_TO_LBS } from "@/lib/units";
import { celebratePR, triggerHaptic } from "@/lib/celebrations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

interface SetRowProps {
  set: WorkoutSet;
  exerciseIndex: number;
  setIndex: number;
  previousSet?: {
    reps: number | null;
    weight: number | null;
  };
  /** Ghost weight in kg (null if no ghost) */
  ghostWeight?: number | null;
  /** Ghost reps (null if no ghost) */
  ghostReps?: number | null;
  /** Display-only suggested weight in kg (never written to store) */
  suggestedWeight?: number | null;
  /** Smart overload suggestion with intent (increase vs maintain) */
  smartSuggestion?: OverloadSuggestion;
  autoFocusWeight?: boolean;
  onUpdate: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  onComplete: (exerciseIndex: number, setIndex: number) => void;
  onRemove: (exerciseIndex: number, setIndex: number) => void;
  onStartRest?: (exerciseId: string, exerciseName: string, seconds: number) => void;
  /** Exercise ID for rest timer */
  exerciseId?: string;
  /** Exercise name for rest timer */
  exerciseName?: string;
}

const setTypeColors: Record<string, string> = {
  warmup: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  working: "bg-primary/20 text-primary border-primary/30",
  dropset: "bg-accent text-accent-foreground border-primary/30",
  failure: "bg-destructive/20 text-destructive border-destructive/30",
};

export const SetRow = memo(function SetRow({
  set,
  exerciseIndex,
  setIndex,
  previousSet,
  ghostWeight = null,
  ghostReps = null,
  suggestedWeight = null,
  smartSuggestion,
  autoFocusWeight = false,
  onUpdate,
  onComplete,
  onRemove,
  onStartRest,
  exerciseId,
  exerciseName,
}: SetRowProps) {
  const { preference, unitLabel } = useUnitPreferenceStore();

  // Conversion helpers — all DB values are true kg
  const toDisplay = (kg: number) =>
    preference === "imperial"
      ? Math.round(kg * KG_TO_LBS * 10) / 10
      : Math.round(kg * 100) / 100;
  const fromDisplay = (val: number) =>
    preference === "imperial" ? val / KG_TO_LBS : val;

  const restSeconds = set.rest_seconds ?? 90;
  const weightValue =
    set.weight_kg === null ? "" : String(toDisplay(set.weight_kg));
  const repsValue = set.reps === null ? "" : String(set.reps);
  const rirValue = set.rir === null ? "" : String(set.rir);

  const handleComplete = () => {
    onComplete(exerciseIndex, setIndex);

    // Enhanced haptic feedback
    triggerHaptic(beatPrevious ? "heavy" : "light");

    // Celebrate PR immediately with confetti
    if (beatPrevious && !set.completed) {
      celebratePR();
    }

    // Start rest timer if completing (not un-completing)
    if (!set.completed && onStartRest && exerciseId && exerciseName) {
      onStartRest(exerciseId, exerciseName, restSeconds);
    }
  };

  const handleWeightChange = (value: string) => {
    if (value === "") {
      onUpdate(exerciseIndex, setIndex, { weight_kg: null });
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      onUpdate(exerciseIndex, setIndex, { weight_kg: fromDisplay(parsed) });
    }
  };

  const handleRepsChange = (value: string) => {
    if (value === "") {
      onUpdate(exerciseIndex, setIndex, { reps: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate(exerciseIndex, setIndex, { reps: parsed });
    }
  };

  const handleRirChange = (value: string) => {
    if (value === "") {
      onUpdate(exerciseIndex, setIndex, { rir: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate(exerciseIndex, setIndex, { rir: Math.max(0, Math.min(10, parsed)) });
    }
  };

  const currentScore =
    set.weight_kg != null && set.reps != null ? set.weight_kg * set.reps : null;

  // PR logic:
  // 1) Weight PR: more weight than previous, regardless of reps.
  // 2) Rep PR: same weight, more reps than previous.
  const previousWeight = previousSet?.weight ?? null;
  const previousReps = previousSet?.reps ?? null;
  const currentWeight = set.weight_kg;
  const currentReps = set.reps;
  const hasComparablePrevious = previousWeight != null && previousReps != null;
  const hasComparableCurrent = currentWeight != null && currentReps != null;
  const weightPR =
    hasComparablePrevious &&
    hasComparableCurrent &&
    currentWeight > previousWeight;
  const repPRAtSameWeight =
    hasComparablePrevious &&
    hasComparableCurrent &&
    currentWeight === previousWeight &&
    currentReps > previousReps;
  const beatPrevious = Boolean(weightPR || repPRAtSameWeight);

  // Ghost workout comparison (from last time doing this template)
  const hasGhost = ghostWeight != null || ghostReps != null;
  const ghostScore =
    ghostWeight != null && ghostReps != null
      ? ghostWeight * ghostReps
      : null;
  const ghostWeightPR =
    ghostWeight != null && set.weight_kg != null && set.weight_kg > ghostWeight;
  const ghostRepPRAtSameWeight =
    ghostWeight != null &&
    ghostReps != null &&
    set.weight_kg != null &&
    set.reps != null &&
    set.weight_kg === ghostWeight &&
    set.reps > ghostReps;
  const beatGhost = Boolean(ghostWeightPR || ghostRepPRAtSameWeight);
  const ghostPercentage =
    ghostScore != null && currentScore != null && ghostScore > 0
      ? Math.round((currentScore / ghostScore) * 100)
      : null;
  const ghostWeightText = ghostWeight != null ? `${toDisplay(ghostWeight)}` : "—";
  const ghostRepsText = ghostReps != null ? `${ghostReps}` : "—";
  const previousWeightText = previousSet?.weight != null ? `${toDisplay(previousSet.weight)}` : "—";
  const previousRepsText = previousSet?.reps != null ? `${previousSet.reps}` : "—";
  const currentWeightText = set.weight_kg != null ? `${toDisplay(set.weight_kg)}` : "—";
  const currentRepsText = set.reps != null ? `${set.reps}` : "—";

  return (
    <motion.div
      animate={set.completed ? {
        boxShadow: ["0 0 0px transparent", "0 0 16px 2px var(--phase-active-glow, oklch(0.78 0.16 195 / 0.20))", "0 0 0px transparent"],
      } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "space-y-1.5 rounded-xl border border-border/60 px-2.5 py-2 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        set.completed
          ? "bg-primary/12 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
          : "bg-secondary/40 hover:border-primary/40 hover:bg-secondary/60"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-foreground">
            {set.set_number}
          </span>

          <button
            onClick={() => {
              const types: WorkoutSet["set_type"][] = [
                "warmup",
                "working",
                "dropset",
                "failure",
              ];
              const currentIdx = types.indexOf(set.set_type);
              const nextType = types[(currentIdx + 1) % types.length];
              onUpdate(exerciseIndex, setIndex, { set_type: nextType });
            }}
            className="flex min-h-[44px] items-center"
          >
            <span className={cn(
              "rounded-md border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
              setTypeColors[set.set_type]
            )}>
              {set.set_type === "working" ? "work" : set.set_type}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-0">
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={set.completed && (beatPrevious || beatGhost) ? { scale: [1, 1.15, 1] } : {}}
            transition={
              set.completed && (beatPrevious || beatGhost)
                ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                : { type: "spring", stiffness: 400, damping: 15 }
            }
          >
            <Button
              variant={set.completed ? "default" : "secondary"}
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 select-none transition-all duration-300",
                set.completed && beatPrevious
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse"
                  : set.completed && beatGhost
                    ? "bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    : set.completed && "bg-primary text-primary-foreground"
              )}
              onClick={handleComplete}
              title={
                beatPrevious && set.completed
                  ? weightPR
                    ? "Weight PR!"
                    : "Rep PR!"
                  : beatGhost && set.completed
                    ? "Beat your ghost!"
                    : undefined
              }
            >
              <motion.div
                initial={false}
                animate={{ scale: set.completed ? 1 : 0.8, rotate: set.completed ? 0 : -45 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {set.completed && beatPrevious ? (
                  <Trophy className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </motion.div>
            </Button>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(exerciseIndex, setIndex)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Ghost workout indicator */}
      {hasGhost && !set.completed && (
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-cyan-400/70">
              <Ghost className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Previous:</span>
              <span className="font-semibold tabular-nums">
                {ghostWeightText} × {ghostRepsText}
              </span>
            </span>
            {ghostPercentage != null && ghostPercentage < 100 && (
              <span className="text-muted-foreground">
                {ghostPercentage}% of ghost
              </span>
            )}
          </div>
        </div>
      )}

      {/* Row 1: Weight + Reps (primary inputs) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label
            htmlFor={`weight-${set.id}`}
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Weight ({unitLabel})
          </label>
          <Input
            id={`weight-${set.id}`}
            autoFocus={autoFocusWeight}
            type="number"
            inputMode="decimal"
            placeholder={smartSuggestion ? String(toDisplay(smartSuggestion.weightKg)) : suggestedWeight != null ? String(toDisplay(suggestedWeight)) : "0"}
            value={weightValue}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="h-10 w-full text-center text-[15px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
          {/* Progressive overload suggestion chip */}
          <AnimatePresence>
            {!set.completed && set.weight_kg === null && smartSuggestion && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  onUpdate(exerciseIndex, setIndex, { weight_kg: smartSuggestion.weightKg });
                  triggerHaptic("light");
                }}
                className={cn(
                  "mt-0.5 inline-flex w-full items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
                  smartSuggestion.intent === "increase"
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                )}
              >
                {smartSuggestion.intent === "increase" ? (
                  <>
                    <ArrowUp className="h-2.5 w-2.5" />
                    {toDisplay(smartSuggestion.weightKg)} {unitLabel}
                  </>
                ) : (
                  <>
                    <Equal className="h-2.5 w-2.5" />
                    {toDisplay(smartSuggestion.weightKg)} {unitLabel}
                  </>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-0.5">
          <label
            htmlFor={`reps-${set.id}`}
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Reps
          </label>
          <Input
            id={`reps-${set.id}`}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={repsValue}
            onChange={(e) => handleRepsChange(e.target.value)}
            className="h-10 w-full text-center text-[15px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>
      </div>

      {/* Row 2: RIR + Rest (secondary, compact) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label
            htmlFor={`rir-${set.id}`}
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            RIR
          </label>
          <Input
            id={`rir-${set.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            placeholder="—"
            value={rirValue}
            onChange={(e) => handleRirChange(e.target.value)}
            className="h-8 w-full text-center text-sm tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-0.5">
          <p
            id={`rest-label-${set.id}`}
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Rest
          </p>
          <Select
            value={String(restSeconds)}
            onValueChange={(value) => onUpdate(exerciseIndex, setIndex, { rest_seconds: Number.parseInt(value, 10) })}
          >
            <SelectTrigger className="h-8 w-full text-xs" aria-labelledby={`rest-label-${set.id}`}>
              <SelectValue placeholder="Rest" />
            </SelectTrigger>
            <SelectContent>
              {REST_PRESETS.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {seconds}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {previousSet && (previousSet.weight != null || previousSet.reps != null) ? (
        <div className={cn(
          "flex items-center justify-between rounded-md border px-2 py-1 text-[12px] transition-all duration-300",
          beatPrevious && set.completed
            ? "border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10"
            : "border-border/50 bg-muted/30"
        )}>
          <span className="text-muted-foreground">
            LAST: <span className="font-medium text-foreground">{previousWeightText} x {previousRepsText}</span>
            {(set.weight_kg != null || set.reps != null) ? (
              <>
                <span className="mx-1.5 text-muted-foreground/70">•</span>
                TODAY: <span className={cn(
                  "font-medium",
                  beatPrevious && set.completed ? "text-yellow-400" : "text-foreground"
                )}>{currentWeightText} x {currentRepsText}</span>
              </>
            ) : null}
          </span>
          {beatPrevious && set.completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-2 py-0.5 font-bold text-black">
              <Trophy className="h-3 w-3" />
              PR
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
});
