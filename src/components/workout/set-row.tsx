"use client";

import { Check, Play, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkoutSet } from "@/types/workout";
import { cn } from "@/lib/utils";
import { REST_PRESETS } from "@/lib/constants";
import { motion } from "framer-motion";
import { celebratePR, triggerHaptic } from "@/lib/celebrations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SetRowProps {
  set: WorkoutSet;
  previousSet?: {
    reps: number | null;
    weight: number | null;
  };
  ghostSet?: {
    reps: number | null;
    weight: number | null;
  };
  autoFocusWeight?: boolean;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
  onStartRest?: (seconds: number) => void;
}

const setTypeColors: Record<string, string> = {
  warmup: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  working: "bg-primary/20 text-primary border-primary/30",
  dropset: "bg-accent text-accent-foreground border-primary/30",
  failure: "bg-destructive/20 text-destructive border-destructive/30",
};

export function SetRow({
  set,
  previousSet,
  ghostSet,
  autoFocusWeight = false,
  onUpdate,
  onComplete,
  onRemove,
  onStartRest,
}: SetRowProps) {
  const restSeconds = set.rest_seconds ?? 90;
  const weightValue = set.weight_kg === null ? "" : String(set.weight_kg);
  const repsValue = set.reps === null ? "" : String(set.reps);

  const handleComplete = () => {
    onComplete();

    // Enhanced haptic feedback
    triggerHaptic(beatPrevious ? "heavy" : "light");

    // Celebrate PR immediately with confetti
    if (beatPrevious && !set.completed) {
      celebratePR();
    }

    // Start rest timer if completing (not un-completing)
    if (!set.completed && onStartRest) {
      onStartRest(restSeconds);
    }
  };

  const handleWeightChange = (value: string) => {
    if (value === "") {
      onUpdate({ weight_kg: null });
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      onUpdate({ weight_kg: parsed });
    }
  };

  const handleRepsChange = (value: string) => {
    if (value === "") {
      onUpdate({ reps: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate({ reps: parsed });
    }
  };

  const previousScore =
    previousSet?.weight != null && previousSet.reps != null
      ? previousSet.weight * previousSet.reps
      : null;
  const currentScore =
    set.weight_kg != null && set.reps != null ? set.weight_kg * set.reps : null;
  const beatPrevious =
    previousScore != null && currentScore != null && currentScore > previousScore;

  // Ghost workout comparison (from last time doing this template)
  const ghostScore =
    ghostSet?.weight != null && ghostSet.reps != null
      ? ghostSet.weight * ghostSet.reps
      : null;
  const beatGhost =
    ghostScore != null && currentScore != null && currentScore > ghostScore;
  const matchedGhost =
    ghostScore != null && currentScore != null && currentScore === ghostScore;
  const ghostPercentage =
    ghostScore != null && currentScore != null && ghostScore > 0
      ? Math.round((currentScore / ghostScore) * 100)
      : null;
  const ghostWeightText = ghostSet?.weight != null ? `${ghostSet.weight}` : "—";
  const ghostRepsText = ghostSet?.reps != null ? `${ghostSet.reps}` : "—";
  const previousWeightText = previousSet?.weight != null ? `${previousSet.weight}` : "—";
  const previousRepsText = previousSet?.reps != null ? `${previousSet.reps}` : "—";
  const currentWeightText = set.weight_kg != null ? `${set.weight_kg}` : "—";
  const currentRepsText = set.reps != null ? `${set.reps}` : "—";

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border border-border/60 px-3.5 py-3 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        set.completed
          ? "bg-primary/12 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
          : "bg-secondary/40 hover:border-primary/40 hover:bg-secondary/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-muted px-2 text-sm font-semibold text-foreground">
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
              onUpdate({ set_type: nextType });
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
              setTypeColors[set.set_type]
            )}
          >
            {set.set_type === "working" ? "work" : set.set_type}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={set.completed && (beatPrevious || beatGhost) ? { scale: [1, 1.15, 1] } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Button
              variant={set.completed ? "default" : "secondary"}
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 transition-all duration-300",
                set.completed && beatPrevious
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse"
                  : set.completed && beatGhost
                    ? "bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    : set.completed && "bg-primary text-primary-foreground"
              )}
              onClick={handleComplete}
              title={
                beatPrevious && set.completed
                  ? "Personal Record! 🏆"
                  : beatGhost && set.completed
                    ? "Beat your ghost! 👻"
                    : undefined
              }
            >
              <motion.div
                initial={false}
                animate={{ scale: set.completed ? 1 : 0.8, rotate: set.completed ? 0 : -45 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {set.completed && beatPrevious ? (
                  <Trophy className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </motion.div>
            </Button>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Ghost workout indicator */}
      {ghostSet && !set.completed && (ghostSet.weight != null || ghostSet.reps != null) && (
        <div className="flex items-center justify-between rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-cyan-400/70">
            <span className="text-[10px]">👻</span>
            <span className="font-medium">LAST TIME:</span>
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
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Weight (lbs)
          </p>
          <Input
            autoFocus={autoFocusWeight}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={weightValue}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Reps
          </p>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={repsValue}
            onChange={(e) => handleRepsChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Rest
          </p>
          <div className="flex items-center gap-1">
            <Select
              value={String(restSeconds)}
              onValueChange={(value) => onUpdate({ rest_seconds: Number.parseInt(value, 10) })}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Rest" />
              </SelectTrigger>
              <SelectContent>
                {REST_PRESETS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {seconds}s rest
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onStartRest?.(restSeconds)}
              title="Start rest timer for this set"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {previousSet && (previousSet.weight != null || previousSet.reps != null) ? (
        <div className={cn(
          "flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition-all duration-300",
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
    </div>
  );
}
