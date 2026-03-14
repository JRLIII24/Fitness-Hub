"use client";

import { memo, useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, ChevronDown, ChevronUp, GripVertical, NotebookPen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SetRow } from "@/components/workout/set-row";
import { ExerciseSparkline } from "@/components/workout/exercise-sparkline";
import { FormTipsPanel } from "@/components/workout/form-tips-panel";
import { RpeDeloadAlert } from "@/components/workout/rpe-deload-alert";
import { weightToDisplay } from "@/lib/units";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import type { WorkoutExercise, WorkoutSet } from "@/types/workout";
import { calcSuggestedWeight, type OverloadSuggestion } from "@/lib/progressive-overload";

export interface ExerciseCardProps {
  exerciseBlock: WorkoutExercise;
  exerciseIndex: number;
  /** Per-exercise ghost sets from the most recent matching session */
  ghostSets: Array<{ setNumber: number; reps: number | null; weight: number | null }> | undefined;
  /** Previous session sets for this exercise (for PR detection ghost) */
  previousSets: Array<{ reps: number | null; weight: number | null }> | undefined;
  /** Suggested weights per set index */
  suggestedWeights: Record<number, number> | undefined;
  /** Smart overload suggestions with intent metadata per set index */
  smartSuggestions: Record<number, OverloadSuggestion> | undefined;
  /** Trendline data for sparkline */
  trendline: { weights: number[]; slope: number } | undefined;
  /** Unit preference */
  preference: "metric" | "imperial";
  /** Optional drag handle props from dnd-kit sortable */
  dragHandleProps?: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown };
  // Actions
  onUpdateSet: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  onCompleteSet: (exerciseIndex: number, setIndex: number) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onSwapExercise: (exerciseIndex: number) => void;
  onSetExerciseNote: (exerciseIndex: number, note: string) => void;
  onStartRest: (exerciseId: string, exerciseName: string, seconds: number) => void;
}

export const ExerciseCard = memo(function ExerciseCard({
  exerciseBlock,
  exerciseIndex,
  ghostSets,
  previousSets,
  suggestedWeights,
  smartSuggestions,
  trendline,
  preference,
  dragHandleProps,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
  onSwapExercise,
  onSetExerciseNote,
  onStartRest,
}: ExerciseCardProps) {
  // Fallback: when ghost-based smartSuggestions is empty but previousSets has data,
  // compute overload suggestions from previous performance so the chip still shows.
  const effectiveSuggestions = useMemo(() => {
    if (smartSuggestions && Object.keys(smartSuggestions).length > 0) return smartSuggestions;
    if (!previousSets) return smartSuggestions;
    const fallback: Record<number, OverloadSuggestion> = {};
    previousSets.forEach((prev, idx) => {
      if (prev.weight != null) {
        fallback[idx] = {
          weightKg: calcSuggestedWeight(prev.weight, preference),
          intent: "increase",
        };
      }
    });
    return Object.keys(fallback).length > 0 ? fallback : smartSuggestions;
  }, [smartSuggestions, previousSets, preference]);

  const [showGhosts, setShowGhosts] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fithub_show_ghost_sets") !== "false";
    }
    return true;
  });

  const [deloadDismissed, setDeloadDismissed] = useState(false);

  // Collapsible state — starts expanded; auto-collapses when all sets are done
  const [isCollapsed, setIsCollapsed] = useState(true);
  const wasAutoCollapsed = useRef(false);
  const allSetsComplete = exerciseBlock.sets.length > 0 && exerciseBlock.sets.every((s) => s.completed);

  useEffect(() => {
    if (allSetsComplete && !wasAutoCollapsed.current) {
      wasAutoCollapsed.current = true;
      setIsCollapsed(true);
    }
    // If a set becomes un-completed, reset the auto-collapse guard so it can fire again later
    if (!allSetsComplete) {
      wasAutoCollapsed.current = false;
    }
  }, [allSetsComplete]);

  // Notes visibility — hidden by default, shown if there's existing content
  const [showNotes, setShowNotes] = useState(() => Boolean(exerciseBlock.notes));

  // Detect consecutive high-effort sets (RIR ≤ 1) among the most recent completed sets
  const completedSets = exerciseBlock.sets.filter((s) => s.completed && s.rir !== null);
  let consecutiveGrinding = 0;
  for (let i = completedSets.length - 1; i >= 0; i--) {
    if (completedSets[i].rir !== null && completedSets[i].rir! <= 1) {
      consecutiveGrinding++;
    } else {
      break;
    }
  }
  const lastCompletedSet = completedSets[completedSets.length - 1];
  const showDeloadAlert =
    !deloadDismissed &&
    consecutiveGrinding >= 2 &&
    lastCompletedSet?.weight_kg != null &&
    lastCompletedSet.weight_kg > 0;

  // Micro-stats for collapsed summary line
  const lastDoneSet = [...exerciseBlock.sets].reverse().find((s) => s.completed);
  const completedCount = exerciseBlock.sets.filter((s) => s.completed).length;

  return (
    <Card className="overflow-hidden glass-surface-elevated shimmer-target transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/30 hover:shadow-lg">
      {/* Progress strip — full primary when all done */}
      <div className={cn(
        "h-0.5 w-full bg-gradient-to-r transition-all duration-500",
        allSetsComplete
          ? "from-primary via-primary to-primary opacity-100"
          : "from-primary via-primary/60 to-accent"
      )} />
      <CardHeader className="px-3 pb-2 pt-2.5">
        <CardTitle className="flex items-center justify-between text-base font-semibold tracking-tight">
          {/* Drag handle */}
          {dragHandleProps && (
            <button
              type="button"
              {...dragHandleProps}
              className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="size-4" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px]">
                {exerciseBlock.exercise.category}
              </Badge>
              {exerciseBlock.exercise.equipment ? (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px]">
                  {EQUIPMENT_LABELS[exerciseBlock.exercise.equipment] ?? exerciseBlock.exercise.equipment}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-start gap-1.5">
              <p className="line-clamp-2 text-sm leading-tight">{exerciseBlock.exercise.name}</p>
              {trendline && (
                <ExerciseSparkline
                  weights={trendline.weights}
                  slope={trendline.slope}
                />
              )}
            </div>
          </div>

          <div className="flex items-start shrink-0">
            <div className="text-right">
              <p className="text-base font-bold font-display tabular-nums leading-none text-primary">
                {exerciseBlock.sets.filter((set) => set.completed).length}
                <span className="text-xs font-medium text-muted-foreground">/{exerciseBlock.sets.length}</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">sets</p>
            </div>
            {/* Collapse toggle */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? "Expand exercise" : "Collapse exercise"}
            >
              {isCollapsed
                ? <ChevronDown className="size-4 text-muted-foreground" />
                : <ChevronUp className="size-4 text-muted-foreground" />
              }
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center"
              onClick={() => onSwapExercise(exerciseIndex)}
              aria-label="Swap exercise"
            >
              <ArrowLeftRight className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center"
              onClick={() => onRemoveExercise(exerciseIndex)}
              aria-label="Remove exercise"
            >
              <X className="size-4 text-destructive" />
            </button>
          </div>
        </CardTitle>
      </CardHeader>

      {/* Collapsed summary line */}
      <AnimatePresence initial={false}>
        {isCollapsed && (
          <motion.div
            key="collapsed-summary"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 text-[12px] text-muted-foreground">
              {allSetsComplete ? (
                <span className="text-primary font-semibold">
                  ✓ {completedCount}/{exerciseBlock.sets.length} sets done
                  {lastDoneSet?.weight_kg != null && lastDoneSet.reps != null
                    ? ` • ${weightToDisplay(lastDoneSet.weight_kg, preference === "imperial", 1)} × ${lastDoneSet.reps}`
                    : ""}
                </span>
              ) : (
                <span>
                  {completedCount}/{exerciseBlock.sets.length} sets done — tap to expand
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="expanded-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Form Tips Panel */}
            {exerciseBlock.exercise.form_tips && exerciseBlock.exercise.form_tips.length > 0 && (
              <FormTipsPanel
                exerciseName={exerciseBlock.exercise.name}
                formTips={exerciseBlock.exercise.form_tips}
              />
            )}
            <CardContent className="space-y-2 px-3 pb-3">
              {ghostSets?.length ? (
                <div className="px-2 pb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGhosts((prev) => {
                        const next = !prev;
                        localStorage.setItem("fithub_show_ghost_sets", String(next));
                        return next;
                      });
                    }}
                    className="flex w-full items-center gap-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showGhosts && "rotate-180")} />
                    Last session
                  </button>
                  <AnimatePresence initial={false}>
                    {showGhosts && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="glass-inner rounded-lg px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {ghostSets
                              .slice()
                              .sort((a, b) => a.setNumber - b.setNumber)
                              .map((ghostSet) => (
                                <span
                                  key={`${exerciseBlock.exercise.id}-ghost-${ghostSet.setNumber}`}
                                  className="glass-chip inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-primary"
                                >
                                  <span className="font-semibold">S{ghostSet.setNumber}</span>
                                  <span className="text-primary">
                                    {ghostSet.weight != null
                                      ? preference === "imperial"
                                        ? weightToDisplay(ghostSet.weight, true, 1)
                                        : ghostSet.weight
                                      : "\u2014"} x {ghostSet.reps ?? "\u2014"}
                                  </span>
                                </span>
                              ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
              {exerciseBlock.sets.map((set, setIndex) => {
                const matchedGhostSet = ghostSets?.find(
                  (ghostSet) => ghostSet.setNumber === set.set_number
                );
                return (
                  <SetRow
                    key={set.id}
                    set={set}
                    exerciseIndex={exerciseIndex}
                    setIndex={setIndex}
                    previousSet={previousSets?.[setIndex]}
                    ghostWeight={matchedGhostSet?.weight ?? null}
                    ghostReps={matchedGhostSet?.reps ?? null}
                    suggestedWeight={suggestedWeights?.[setIndex] ?? null}
                    smartSuggestion={effectiveSuggestions?.[setIndex]}
                    autoFocusWeight={setIndex === exerciseBlock.sets.length - 1 && !set.completed}
                    onUpdate={onUpdateSet}
                    onComplete={onCompleteSet}
                    onRemove={onRemoveSet}
                    onStartRest={onStartRest}
                    exerciseId={exerciseBlock.exercise.id}
                    exerciseName={exerciseBlock.exercise.name}
                  />
                );
              })}
              {/* Deload alert — shown when 2+ consecutive sets at RIR ≤ 1 */}
              <AnimatePresence>
                {showDeloadAlert && lastCompletedSet?.weight_kg != null && (
                  <RpeDeloadAlert
                    lastWeightKg={lastCompletedSet.weight_kg}
                    consecutiveCount={consecutiveGrinding}
                    preference={preference}
                    onApplyDeload={(newWeightKg) => {
                      // Pre-fill the next incomplete set's weight
                      const nextIncompleteIdx = exerciseBlock.sets.findIndex((s) => !s.completed);
                      if (nextIncompleteIdx !== -1) {
                        onUpdateSet(exerciseIndex, nextIncompleteIdx, { weight_kg: newWeightKg });
                      }
                      setDeloadDismissed(true);
                    }}
                    onDismiss={() => setDeloadDismissed(true)}
                  />
                )}
              </AnimatePresence>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full text-sm transition-all duration-200 hover:scale-[1.01]"
                onClick={() => onAddSet(exerciseIndex)}
              >
                Add Set
              </Button>

              {/* Exercise Notes — collapsed by default */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowNotes((prev) => !prev)}
                  className="flex min-h-[44px] w-full items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  <span className="font-medium">Notes</span>
                  {showNotes
                    ? <ChevronUp className="ml-auto h-3.5 w-3.5" />
                    : <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  }
                </button>
                <AnimatePresence initial={false}>
                  {showNotes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <Textarea
                        placeholder="Notes for this exercise…"
                        value={exerciseBlock.notes}
                        onChange={(e) => onSetExerciseNote(exerciseIndex, e.target.value)}
                        className="mt-1 min-h-[48px] resize-none text-xs"
                        rows={2}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}, function exerciseCardAreEqual(prev, next) {
  if (prev.exerciseIndex !== next.exerciseIndex) return false;
  if (prev.preference !== next.preference) return false;

  const pBlock = prev.exerciseBlock;
  const nBlock = next.exerciseBlock;
  if (pBlock.exercise.id !== nBlock.exercise.id) return false;
  if (pBlock.notes !== nBlock.notes) return false;
  if (pBlock.sets.length !== nBlock.sets.length) return false;
  for (let i = 0; i < pBlock.sets.length; i++) {
    const ps = pBlock.sets[i];
    const ns = nBlock.sets[i];
    if (
      ps.weight_kg !== ns.weight_kg ||
      ps.reps !== ns.reps ||
      ps.completed !== ns.completed ||
      ps.rir !== ns.rir ||
      ps.set_type !== ns.set_type ||
      ps.id !== ns.id ||
      ps.is_predicted !== ns.is_predicted
    ) return false;
  }

  if (prev.ghostSets !== next.ghostSets) return false;
  if (prev.previousSets !== next.previousSets) return false;
  if (prev.suggestedWeights !== next.suggestedWeights) return false;
  if (prev.smartSuggestions !== next.smartSuggestions) return false;
  if (prev.trendline !== next.trendline) return false;
  if (prev.dragHandleProps !== next.dragHandleProps) return false;
  if (prev.onUpdateSet !== next.onUpdateSet) return false;
  if (prev.onCompleteSet !== next.onCompleteSet) return false;
  if (prev.onRemoveSet !== next.onRemoveSet) return false;
  if (prev.onAddSet !== next.onAddSet) return false;
  if (prev.onRemoveExercise !== next.onRemoveExercise) return false;
  if (prev.onSwapExercise !== next.onSwapExercise) return false;
  if (prev.onSetExerciseNote !== next.onSetExerciseNote) return false;
  if (prev.onStartRest !== next.onStartRest) return false;

  return true;
});
