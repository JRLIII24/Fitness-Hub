"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { makeCustomExercise } from "@/lib/workout/exercise-resolver";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface ExerciseSwapSheetProps {
  open: boolean;
  exerciseIndex: number | null;
  /** The exercise being replaced (to pre-select its muscle group tab) */
  currentExercise: Exercise | null;
  onSwap: (exerciseIndex: number, newExercise: Exercise) => void;
  onClose: () => void;
}

export function ExerciseSwapSheet({
  open,
  exerciseIndex,
  currentExercise,
  onSwap,
  onClose,
}: ExerciseSwapSheetProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  // Custom exercise form state
  const [customName, setCustomName] = useState("");
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>("full_body");
  const [customEquipment, setCustomEquipment] = useState("bodyweight");

  // Whether the inline "create custom" empty state should show
  const showInlineCreate = !loading && exercises.length === 0 && search.trim().length >= 2;

  // Stable seq counter to discard stale responses
  const searchSeq = useRef(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (open && currentExercise) {
      const mg = currentExercise.muscle_group as MuscleGroup;
      setSelectedMuscleGroup(MUSCLE_GROUPS.includes(mg) ? mg : "chest");
      setSearch("");
      setCustomName("");
    }
  }, [open, currentExercise]);

  // Sync search query → custom name when no results found
  useEffect(() => {
    if (showInlineCreate) {
      setCustomName(search.trim());
      setCustomMuscleGroup(selectedMuscleGroup);
    }
  }, [showInlineCreate, search, selectedMuscleGroup]);

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
          params.set("muscle_group", selectedMuscleGroup);
        }

        const res = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch exercises");

        const data = await res.json();
        if (seq !== searchSeq.current) return;

        const all: Exercise[] = data.exercises ?? [];
        // Filter to selected muscle group when no search query
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

  function handleSelect(exercise: Exercise) {
    if (exerciseIndex == null) return;
    onSwap(exerciseIndex, exercise);
    onClose();
    toast.success(`Swapped to ${exercise.name}`);
  }

  function handleCreateCustomAndSwap() {
    const name = customName.trim();
    if (name.length < 3) {
      toast.error("Custom exercise name must be at least 3 characters.");
      return;
    }
    if (exerciseIndex == null) return;
    const customExercise = makeCustomExercise(name, customMuscleGroup, customEquipment);
    onSwap(exerciseIndex, customExercise);
    onClose();
    toast.success(`Swapped to ${customExercise.name}`);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex h-[80dvh] flex-col">
        <SheetHeader>
          <SheetTitle>Swap Exercise</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MUSCLE_GROUPS.map((group) => {
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
                className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all duration-150"
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

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="mt-2"
          autoFocus
        />

        <ScrollArea className="mt-2 min-h-0 flex-1">
          <div className="space-y-1.5 pr-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : exercises.length === 0 ? (
              showInlineCreate ? (
                <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                  <p className="text-[13px] font-bold text-foreground">
                    Create &ldquo;{search.trim()}&rdquo;
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    No matches found. Add it as a custom exercise.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Exercise name"
                      className="h-9"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                      onClick={handleCreateCustomAndSwap}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Create & Swap
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
              )
            ) : (
              exercises.map((exercise) => {
                const isCurrent = exercise.id === currentExercise?.id;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleSelect(exercise)}
                    disabled={isCurrent}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isCurrent
                        ? "cursor-not-allowed border-border/50 bg-card/40 opacity-50"
                        : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{exercise.name}</p>
                      {isCurrent && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ??
                        exercise.muscle_group}
                      {exercise.equipment
                        ? ` · ${EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}`
                        : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="mt-2 border-t border-border/40 pt-2">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
