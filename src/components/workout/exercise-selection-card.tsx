"use client";

import { useState } from "react";
import { ChevronDown, Plus, Zap, TrendingUp, Target } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";

interface PreviousPerformance {
  reps: number | null;
  weight: number | null;
  performedAt?: string | null;
}

interface ExerciseSelectionCardProps {
  exercise: Exercise;
  mediaUrl?: string | null;
  posterUrl?: string | null;
  primaryBenefit: string;
  coachingCues: string[];
  previousPerformance?: PreviousPerformance | null;
  selected: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
}

export function ExerciseSelectionCard({
  exercise,
  primaryBenefit,
  coachingCues,
  previousPerformance,
  selected,
  onSelect,
  onQuickAdd,
}: ExerciseSelectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const muscleLabel =
    MUSCLE_GROUP_LABELS[exercise.muscle_group as keyof typeof MUSCLE_GROUP_LABELS] ??
    exercise.muscle_group ??
    "General";
  const equipmentLabel =
    (exercise.equipment && EQUIPMENT_LABELS[exercise.equipment as keyof typeof EQUIPMENT_LABELS]) ??
    exercise.equipment ??
    "Bodyweight";

  function formatLastPerformance() {
    if (!previousPerformance) return "No history yet";
    const hasWeight = previousPerformance.weight != null;
    const hasReps = previousPerformance.reps != null;
    if (!hasWeight && !hasReps) return "No history yet";
    const weight = hasWeight ? `${previousPerformance.weight}kg` : "BW";
    const reps = hasReps ? `${previousPerformance.reps}` : "—";
    return `${weight} × ${reps}`;
  }

  function handlePrimaryTap() {
    if (!selected) {
      onSelect();
      setExpanded(true);
      return;
    }
    setExpanded((v) => !v);
  }

  function handleToggleExpand() {
    if (!selected) onSelect();
    setExpanded((v) => !v);
  }

  const lastPerf = formatLastPerformance();
  const hasHistory = lastPerf !== "No history yet";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all duration-200",
        selected
          ? "border-primary/60 bg-card shadow-[0_0_16px_rgba(255,255,255,0.06)]"
          : "border-border/60 bg-card/50 hover:border-border hover:bg-card/80"
      )}
    >
      {/* Main row — always visible */}
      <button
        type="button"
        onClick={handlePrimaryTap}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {/* Muscle group color dot */}
        <div
          className={cn(
            "h-8 w-1 shrink-0 rounded-full",
            selected ? "bg-primary" : "bg-border"
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{exercise.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="secondary"
              className="h-4 rounded px-1.5 text-[10px] tracking-wide"
            >
              {muscleLabel}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{equipmentLabel}</span>
            {hasHistory && (
              <>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <span className="text-[10px] text-muted-foreground">
                  Last: <span className="text-foreground/80 font-medium">{lastPerf}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick add */}
        <button
          type="button"
          aria-label={`Quick add ${exercise.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:bg-muted",
            expanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </button>

      {/* Expandable details */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border/40 bg-muted/20 px-4 py-3">
            {primaryBenefit && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Primary Benefit
                </p>
                <p className="mt-0.5 text-xs text-foreground/90">{primaryBenefit}</p>
              </div>
            )}

            {coachingCues.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Coaching Cues
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {coachingCues.slice(0, 2).map((cue, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      · {cue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              className="h-8 w-full justify-between text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd();
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add to Workout
              </span>
              <span className="inline-flex items-center gap-1 text-primary-foreground/70">
                <Zap className="h-3 w-3" />
                <TrendingUp className="h-3 w-3" />
                <Target className="h-3 w-3" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
