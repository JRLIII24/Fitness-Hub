"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
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
}

export function ExerciseLibrarySheet({
  open,
  onClose,
  selectedExerciseIds,
  onAddExercise,
  onCreateCustomExercise,
}: ExerciseLibrarySheetProps) {
  const supabase = useMemo(() => createClient(), []);
  const { preference, unitLabel } = useUnitPreferenceStore();

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const searchSeq = useRef(0);

  // Custom exercise form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>("full_body");
  const [customEquipment, setCustomEquipment] = useState("bodyweight");

  // Last performance data for exercises in the picker
  const [lastPerformance, setLastPerformance] = useState<
    Record<string, { reps: number | null; weight: number | null; performedAt: string | null }>
  >({});

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setShowCustomForm(false);
      setCustomName("");
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
    const name = customName.trim();
    if (name.length < 3) {
      toast.error("Custom exercise name must be at least 3 characters.");
      return;
    }
    await onCreateCustomExercise(name, customMuscleGroup, customEquipment);
    setCustomName("");
    setShowCustomForm(false);
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
      <SheetContent side="bottom" className="flex h-[90dvh] flex-col">
        <SheetHeader>
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        {/* Muscle group tabs */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
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
        <ScrollArea className="mt-2 min-h-0 flex-1">
          <div className="space-y-1.5 pr-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : exercises.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
            ) : (
              exercises.map((exercise) => {
                const isAdded = selectedExerciseIds.has(exercise.id);
                const perf = formatPerf(exercise.id);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleQuickAdd(exercise)}
                    disabled={isAdded}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isAdded
                        ? "cursor-default border-primary/30 bg-primary/5 opacity-70"
                        : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
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
                      {isAdded ? (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Custom exercise section */}
        <div className="mt-2 border-t border-border/40 pt-2">
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="flex w-full items-center justify-between py-1.5 text-xs font-semibold text-muted-foreground"
          >
            <span>Create Custom Exercise</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCustomForm && "rotate-180")} />
          </button>

          {showCustomForm && (
            <div className="space-y-2.5 pt-1.5 pb-1">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Exercise name"
                className="h-9"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={customMuscleGroup} onValueChange={(v) => setCustomMuscleGroup(v as MuscleGroup)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Muscle group" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {MUSCLE_GROUP_LABELS[group]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={customEquipment} onValueChange={setCustomEquipment}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="h-9 w-full text-xs"
                onClick={handleCreateCustom}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create & Add
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
