"use client";

import { ArrowLeftRight, NotebookPen, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SetRow } from "@/components/workout/set-row";
import { ExerciseSparkline } from "@/components/workout/exercise-sparkline";
import { FormTipsPanel } from "@/components/workout/form-tips-panel";
import { weightToDisplay } from "@/lib/units";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import type { WorkoutExercise, WorkoutSet } from "@/types/workout";

type MuscleGroup = string;

export interface ExerciseCardProps {
  exerciseBlock: WorkoutExercise;
  exerciseIndex: number;
  /** Per-exercise ghost sets from the most recent matching session */
  ghostSets: Array<{ setNumber: number; reps: number | null; weight: number | null }> | undefined;
  /** Previous session sets for this exercise (for PR detection ghost) */
  previousSets: Array<{ reps: number | null; weight: number | null }> | undefined;
  /** Suggested weights per set index */
  suggestedWeights: Record<number, number> | undefined;
  /** Trendline data for sparkline */
  trendline: { weights: number[]; slope: number } | undefined;
  /** Unit preference */
  preference: "metric" | "imperial";
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

export function ExerciseCard({
  exerciseBlock,
  exerciseIndex,
  ghostSets,
  previousSets,
  suggestedWeights,
  trendline,
  preference,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
  onSwapExercise,
  onSetExerciseNote,
  onStartRest,
}: ExerciseCardProps) {
  return (
    <Card className="overflow-hidden glass-surface-elevated glass-highlight transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/30 hover:shadow-lg">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-accent" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-[20px] font-semibold tracking-tight">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                {exerciseBlock.exercise.category}
              </Badge>
              {exerciseBlock.exercise.equipment ? (
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                  {EQUIPMENT_LABELS[exerciseBlock.exercise.equipment] ?? exerciseBlock.exercise.equipment}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <p>{exerciseBlock.exercise.name}</p>
              {trendline && (
                <ExerciseSparkline
                  weights={trendline.weights}
                  slope={trendline.slope}
                />
              )}
            </div>
            {previousSets?.length ? (
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                Ghost: last session sets loaded
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-lg font-bold leading-none text-primary">
                {exerciseBlock.sets.filter((set) => set.completed).length}
                <span className="text-sm font-medium text-muted-foreground">/{exerciseBlock.sets.length}</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">sets done</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onSwapExercise(exerciseIndex)}
              title="Swap exercise"
            >
              <ArrowLeftRight className="size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onRemoveExercise(exerciseIndex)}
            >
              <X className="size-4 text-destructive" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {/* Form Tips Panel */}
      {exerciseBlock.exercise.form_tips && exerciseBlock.exercise.form_tips.length > 0 && (
        <FormTipsPanel
          exerciseName={exerciseBlock.exercise.name}
          formTips={exerciseBlock.exercise.form_tips}
        />
      )}
      <CardContent className="space-y-3 px-5 pb-5">
        {ghostSets?.length ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-300/80">
              Last Session Set Ladder
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ghostSets
                .slice()
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((ghostSet) => (
                  <span
                    key={`${exerciseBlock.exercise.id}-ghost-${ghostSet.setNumber}`}
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200"
                  >
                    <span className="font-semibold">S{ghostSet.setNumber}</span>
                    <span className="text-cyan-100/90">
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
        ) : null}
        {exerciseBlock.sets.map((set, setIndex) => {
          const matchedGhostSet = ghostSets?.find(
            (ghostSet) => ghostSet.setNumber === set.set_number
          );
          return (
            <SetRow
              key={set.id}
              set={set}
              previousSet={previousSets?.[setIndex]}
              ghostSet={
                matchedGhostSet
                  ? {
                    reps: matchedGhostSet.reps,
                    weight: matchedGhostSet.weight,
                  }
                  : undefined
              }
              suggestedWeight={
                suggestedWeights?.[setIndex] ?? null
              }
              autoFocusWeight={setIndex === exerciseBlock.sets.length - 1 && !set.completed}
              onUpdate={(updates) => onUpdateSet(exerciseIndex, setIndex, updates)}
              onComplete={() => onCompleteSet(exerciseIndex, setIndex)}
              onRemove={() => onRemoveSet(exerciseIndex, setIndex)}
              onStartRest={(seconds) => {
                onStartRest(
                  exerciseBlock.exercise.id,
                  exerciseBlock.exercise.name,
                  seconds
                );
              }}
            />
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="w-full transition-all duration-200 hover:scale-[1.01]"
          onClick={() => onAddSet(exerciseIndex)}
        >
          Add Set
        </Button>
        {/* Exercise Notes */}
        <div className="space-y-1.5 pt-1">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <NotebookPen className="h-3 w-3" />
            Exercise notes
          </Label>
          <Textarea
            placeholder="Notes for this exercise (optional)..."
            value={exerciseBlock.notes}
            onChange={(e) => onSetExerciseNote(exerciseIndex, e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
