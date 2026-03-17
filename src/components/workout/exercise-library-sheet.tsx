"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_TYPES, WORKOUT_TYPES, WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { getMuscleColor } from "@/lib/muscle-colors";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface ExerciseLibrarySheetProps {
  open: boolean;
  onClose: () => void;
  /** IDs of exercises already in the active workout */
  selectedExerciseIds: Set<string>;
  /** Callback to add an exercise to the active workout */
  onAddExercise: (exercise: Exercise) => Promise<void>;
  /** Callback to create and add a custom exercise */
  onCreateCustomExercise: (name: string, muscleGroup: string, equipment: string) => Promise<void>;
  /** Current workout name (optional — enables inline edit) */
  workoutName?: string;
  onWorkoutNameChange?: (name: string) => void;
  /** Current workout type (optional — enables inline edit) */
  workoutType?: string | null;
  onWorkoutTypeChange?: (type: string) => void;
}

export function ExerciseLibrarySheet({
  open,
  onClose,
  selectedExerciseIds,
  onAddExercise,
  onCreateCustomExercise,
  workoutName,
  onWorkoutNameChange,
  workoutType,
  onWorkoutTypeChange,
}: ExerciseLibrarySheetProps) {
  const supabase = useMemo(() => createClient(), []);
  const { preference, unitLabel } = useUnitPreferenceStore();

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const searchSeq = useRef(0);

  // Custom exercise equipment pick
  const [customEquipment, setCustomEquipment] = useState("bodyweight");

  // Last performance data for exercises in the picker
  const [lastPerformance, setLastPerformance] = useState<
    Record<string, { reps: number | null; weight: number | null; performedAt: string | null }>
  >({});

  // Whether the inline "create custom" empty state should show
  const showInlineCreate = !loading && exercises.length === 0 && search.trim().length >= 2;

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  // Fetch exercises when muscle group or search changes
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const seq = ++searchSeq.current;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const q = search.trim();
        if (q.length > 0) {
          params.set("query", q);
          params.set("muscle_group", selectedMuscleGroup);
        } else {
          params.set("muscle_groups", selectedMuscleGroup);
        }

        const res = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch exercises");

        const data = await res.json();
        if (seq !== searchSeq.current) return;

        const all: Exercise[] = data.exercises ?? [];
        const filtered =
          q.length === 0
            ? all.filter((e) => e.muscle_group === selectedMuscleGroup)
            : all;
        setExercises(filtered.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        toast.error("Failed to load exercises");
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, selectedMuscleGroup, search]);

  // Load last performance for visible exercises
  useEffect(() => {
    if (!open || exercises.length === 0) return;

    async function loadPerformance() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const ids = exercises.slice(0, 120).map((e) => e.id);
      if (ids.length === 0) return;

      const { data } = await supabase
        .from("user_exercise_last_performance")
        .select("exercise_id,best_set,last_performed_at")
        .eq("user_id", userId)
        .in("exercise_id", ids);

      if (!data) return;

      const map: Record<string, { reps: number | null; weight: number | null; performedAt: string | null }> = {};
      for (const row of data) {
        const best = row.best_set as { reps?: number | null; weight_kg?: number | null };
        map[row.exercise_id] = {
          reps: best?.reps ?? null,
          weight: best?.weight_kg ?? null,
          performedAt: row.last_performed_at ?? null,
        };
      }
      setLastPerformance(map);
    }

    void loadPerformance();
  }, [open, exercises, supabase]);

  async function handleQuickAdd(exercise: Exercise) {
    if (selectedExerciseIds.has(exercise.id)) {
      toast.message(`${exercise.name} is already in this session`);
      return;
    }
    await onAddExercise(exercise);
  }

  async function handleCreateCustom() {
    const name = search.trim();
    if (name.length < 2) {
      toast.error("Exercise name must be at least 2 characters.");
      return;
    }
    await onCreateCustomExercise(name, selectedMuscleGroup, customEquipment);
    setSearch("");
    toast.success(`Created & added ${name}`);
  }

  function formatPerf(exerciseId: string) {
    const perf = lastPerformance[exerciseId];
    if (!perf) return null;
    const hasWeight = perf.weight != null;
    const hasReps = perf.reps != null;
    if (!hasWeight && !hasReps) return null;
    const w = hasWeight
      ? `${weightToDisplay(perf.weight ?? 0, preference === "imperial", 1)} ${unitLabel}`
      : "BW";
    const r = hasReps ? `${perf.reps}` : "—";
    return `${w} × ${r}`;
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex h-[90dvh] flex-col px-4">
        <SheetHeader className="px-0">
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        {/* Workout metadata editing */}
        {onWorkoutNameChange && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-card/30 p-3">
            <Input
              value={workoutName ?? ""}
              onChange={(e) => onWorkoutNameChange(e.target.value)}
              placeholder="Workout name"
              className="h-8 border-transparent bg-transparent px-0 text-sm font-semibold focus:border-border focus:bg-background"
            />
            {onWorkoutTypeChange && (
              <div className="flex flex-wrap gap-1.5">
                {WORKOUT_TYPES.map((wt) => {
                  const active = workoutType === wt;
                  return (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => onWorkoutTypeChange(wt)}
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize transition-all",
                        active
                          ? "border-[1.5px] border-primary/50 bg-primary/15 text-primary"
                          : "border border-border/60 bg-transparent text-muted-foreground"
                      )}
                    >
                      {WORKOUT_TYPE_LABELS[wt]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Muscle group tabs */}
        <div className="-mx-4 mt-2 flex min-w-0 gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
          {MUSCLE_GROUPS.filter((g) => g !== "full_body").map((group) => {
            const gc = getMuscleColor(group);
            const active = selectedMuscleGroup === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => {
                  setSelectedMuscleGroup(group);
                  setSearch("");
                }}
                className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-all duration-150"
                style={{
                  background: active ? gc.bgAlpha : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? gc.borderAlpha : "rgba(255,255,255,0.08)"}`,
                  color: active ? gc.labelColor : "hsl(var(--muted-foreground))",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {MUSCLE_GROUP_LABELS[group] ?? group}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="mt-2"
          autoFocus
        />

        {/* Exercise list */}
        <ScrollArea className="mt-2 min-h-0 min-w-0 flex-1">
          <div className="space-y-1.5 pr-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* Inline create — shown when search has no DB results */}
                {showInlineCreate && (
                  <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[12px] font-semibold text-foreground">
                      Create &ldquo;{search.trim()}&rdquo;
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {EQUIPMENT_TYPES.map((eq) => {
                        const active = customEquipment === eq;
                        return (
                          <button
                            key={eq}
                            type="button"
                            onClick={() => setCustomEquipment(eq)}
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                              active
                                ? "border-[1.5px] border-primary/50 bg-primary/15 text-primary"
                                : "border border-border/60 bg-transparent text-muted-foreground"
                            )}
                          >
                            {EQUIPMENT_LABELS[eq] ?? eq}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCustom}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors active:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Create & Add
                    </button>
                  </div>
                )}

                {exercises.length === 0 && !showInlineCreate && (
                  <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
                )}

                {/* Exercise cards — entire card is the tap target */}
                {exercises.map((exercise) => {
                  const isAdded = selectedExerciseIds.has(exercise.id);
                  const perf = formatPerf(exercise.id);
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleQuickAdd(exercise)}
                      disabled={isAdded}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.98]",
                        isAdded
                          ? "cursor-default border-primary/30 bg-primary/5 opacity-70"
                          : "border-border/70 bg-card/70 active:border-primary/40 active:bg-primary/5"
                      )}
                    >
                      {/* Status circle */}
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                        isAdded
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/70 bg-card/50"
                      )}>
                        {isAdded ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-snug">{exercise.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="h-4 rounded px-1.5 text-[10px]">
                            {MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ?? exercise.muscle_group}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {EQUIPMENT_LABELS[exercise.equipment as string] ?? exercise.equipment ?? "Bodyweight"}
                          </span>
                          {perf && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">·</span>
                              <span className="text-[10px] text-muted-foreground">
                                Last: <span className="font-medium text-foreground/80">{perf}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>

      </SheetContent>
    </Sheet>
  );
}
