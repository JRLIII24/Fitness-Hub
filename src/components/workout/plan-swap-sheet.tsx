"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, Search, Loader2, Plus, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Exercise, PlanExercise } from "@/types/workout";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  EQUIPMENT_LABELS,
} from "@/lib/constants";
import { getMuscleColor } from "@/lib/muscle-colors";
import { cn } from "@/lib/utils";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface AISuggestion {
  name: string;
  rationale: string;
}

interface PlanSwapSheetProps {
  open: boolean;
  exerciseIndex: number | null;
  currentExercise: PlanExercise | null;
  existingExerciseNames: string[];
  onSwap: (exerciseIndex: number, newExercise: Exercise) => void;
  onClose: () => void;
}

export function PlanSwapSheet({
  open,
  exerciseIndex,
  currentExercise,
  existingExerciseNames,
  onSwap,
  onClose,
}: PlanSwapSheetProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] =
    useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  // Custom exercise input
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");

  const searchSeq = useRef(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (open && currentExercise) {
      const mg = currentExercise.muscleGroup as MuscleGroup;
      setSelectedMuscleGroup(MUSCLE_GROUPS.includes(mg) ? mg : "chest");
      setSearch("");
      setShowCustom(false);
      setCustomName("");
      setAiSuggestions([]);
      setAiExpanded(false);

      // Fetch AI suggestions
      fetchAiSuggestions(
        currentExercise.exercise.name,
        currentExercise.muscleGroup,
        currentExercise.exercise.equipment,
      );
    }
  }, [open, currentExercise]);

  async function fetchAiSuggestions(
    exerciseName: string,
    muscleGroup: string,
    equipment: string | null,
  ) {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/plan-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_name: exerciseName,
          muscle_group: muscleGroup,
          equipment,
          existing_exercises: existingExerciseNames,
        }),
      });
      if (!res.ok) throw new Error("AI unavailable");
      const data = await res.json();
      setAiSuggestions(data.suggestions ?? []);
    } catch {
      // Silently fail — manual search is always available
    } finally {
      setAiLoading(false);
    }
  }

  // Fetch exercises for manual search
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
        const filtered =
          q.length === 0
            ? all.filter((e) => e.muscle_group === selectedMuscleGroup)
            : all;
        setExercises(filtered.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, selectedMuscleGroup, search]);

  function handleSelectExercise(exercise: Exercise) {
    if (exerciseIndex == null) return;
    onSwap(exerciseIndex, exercise);
    onClose();
    toast.success(`Swapped to ${exercise.name}`);
  }

  function handleSelectAiSuggestion(suggestion: AISuggestion) {
    // Find the exercise in the fetched list or create a placeholder
    const match = exercises.find(
      (e) => e.name.toLowerCase() === suggestion.name.toLowerCase(),
    );
    if (match) {
      handleSelectExercise(match);
      return;
    }
    // Search for it
    setSearch(suggestion.name);
  }

  function handleAddCustom() {
    const name = customName.trim();
    if (!name || exerciseIndex == null) return;
    // Create a custom exercise placeholder — will be resolved in handleConfirmPlan
    const custom: Exercise = {
      id: `custom-${Date.now()}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      muscle_group: currentExercise?.muscleGroup ?? "chest",
      equipment: null,
      category: "compound",
      instructions: null,
      form_tips: null,
      image_url: null,
    };
    onSwap(exerciseIndex, custom);
    onClose();
    toast.success(`Added ${name}`);
  }

  const isCurrent = (ex: Exercise) =>
    ex.id === currentExercise?.exercise.id;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex h-[85dvh] flex-col">
        <SheetHeader>
          <SheetTitle>
            Swap{" "}
            {currentExercise?.exercise.name
              ? `"${currentExercise.exercise.name}"`
              : "Exercise"}
          </SheetTitle>
        </SheetHeader>

        {/* AI Suggestions — collapsible pill */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setAiExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 transition-colors active:bg-primary/10"
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-3 w-3 text-primary" />
            )}
            <span className="text-[11px] font-semibold text-primary">
              {aiLoading ? "Finding alternatives…" : `AI Suggestions${aiSuggestions.length > 0 ? ` (${aiSuggestions.length})` : ""}`}
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-primary/60 transition-transform duration-200",
                aiExpanded && "rotate-180",
              )}
            />
          </button>

          {aiExpanded && !aiLoading && aiSuggestions.length > 0 && (
            <div className="mt-1.5 grid grid-cols-1 gap-1.5">
              {aiSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => handleSelectAiSuggestion(s)}
                  className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left transition active:border-primary/40 active:bg-primary/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.rationale}
                    </p>
                  </div>
                  <Sparkles className="h-3 w-3 shrink-0 text-primary/60" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Muscle group tabs */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
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
                  background: active
                    ? gc.bgAlpha
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? gc.borderAlpha : "rgba(255,255,255,0.08)"}`,
                  color: active
                    ? gc.labelColor
                    : "hsl(var(--muted-foreground))",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {MUSCLE_GROUP_LABELS[group] ?? group}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="pl-8"
          />
        </div>

        {/* Exercise list */}
        <ScrollArea className="mt-2 min-h-0 flex-1">
          <div className="space-y-1.5 pr-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : exercises.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No exercises found.
              </p>
            ) : (
              exercises.map((exercise) => {
                const current = isCurrent(exercise);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleSelectExercise(exercise)}
                    disabled={current}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      current
                        ? "cursor-not-allowed border-border/50 bg-card/40 opacity-50"
                        : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">
                        {exercise.name}
                      </p>
                      {current && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px]"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {MUSCLE_GROUP_LABELS[
                        exercise.muscle_group as MuscleGroup
                      ] ?? exercise.muscle_group}
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

        {/* Custom exercise + Cancel */}
        <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
          {showCustom ? (
            <div className="flex gap-2">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom exercise name…"
                autoFocus
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              />
              <Button
                size="sm"
                onClick={handleAddCustom}
                disabled={!customName.trim()}
              >
                Add
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => setShowCustom(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Exercise
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
