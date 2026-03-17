"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Check, Plus, Sparkles, Search, Loader2, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_TYPES } from "@/lib/constants";
import { getMuscleColor } from "@/lib/muscle-colors";
import { cn } from "@/lib/utils";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface AISuggestion {
  name: string;
  rationale: string;
}

interface ExerciseSwapSheetProps {
  open: boolean;
  exerciseIndex: number | null;
  /** The exercise being replaced (to pre-select its muscle group tab) */
  currentExercise: Exercise | null;
  existingExerciseNames?: string[];
  onSwap: (exerciseIndex: number, newExercise: Exercise) => void;
  onClose: () => void;
}

export function ExerciseSwapSheet({
  open,
  exerciseIndex,
  currentExercise,
  existingExerciseNames = [],
  onSwap,
  onClose,
}: ExerciseSwapSheetProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [customEquipment, setCustomEquipment] = useState("bodyweight");

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  const showInlineCreate = !loading && exercises.length === 0 && search.trim().length >= 2;
  const searchSeq = useRef(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (open && currentExercise) {
      const mg = currentExercise.muscle_group as MuscleGroup;
      setSelectedMuscleGroup(MUSCLE_GROUPS.includes(mg) ? mg : "chest");
      setSearch("");
      setAiSuggestions([]);
      setAiExpanded(false);

      // Fetch AI suggestions
      fetchAiSuggestions(
        currentExercise.name,
        currentExercise.muscle_group,
        currentExercise.equipment,
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

  function handleSelectAiSuggestion(suggestion: AISuggestion) {
    const match = exercises.find(
      (e) => e.name.toLowerCase() === suggestion.name.toLowerCase(),
    );
    if (match) {
      handleSelect(match);
      return;
    }
    // Search for it
    setSearch(suggestion.name);
  }

  async function handleCreateCustomAndSwap() {
    const name = search.trim();
    if (name.length < 2) {
      toast.error("Exercise name must be at least 2 characters.");
      return;
    }
    if (exerciseIndex == null) return;

    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          muscle_group: selectedMuscleGroup,
          equipment: customEquipment,
          category: "isolation",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create exercise");
      }

      const data = await res.json();
      const exercise: Exercise = {
        id: data.id,
        name: data.name,
        slug: data.slug ?? "",
        muscle_group: data.muscle_group,
        equipment: data.equipment,
        category: data.category,
        instructions: data.instructions ?? null,
        form_tips: null,
        image_url: null,
        is_custom: true,
      };

      onSwap(exerciseIndex, exercise);
      onClose();
      toast.success(`Swapped to ${exercise.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create exercise");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex h-[85dvh] flex-col px-4">
        <SheetHeader className="px-0">
          <SheetTitle>
            Swap{" "}
            {currentExercise?.name
              ? `"${currentExercise.name}"`
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
        <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
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

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or type to create…"
            className="pl-8"
          />
        </div>

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
                      onClick={handleCreateCustomAndSwap}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors active:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Create & Swap
                    </button>
                  </div>
                )}

                {exercises.length === 0 && !showInlineCreate && (
                  <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
                )}

                {/* Exercise cards — entire card is the tap target */}
                {exercises.map((exercise) => {
                  const isCurrent = exercise.id === currentExercise?.id;
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleSelect(exercise)}
                      disabled={isCurrent}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.98]",
                        isCurrent
                          ? "cursor-not-allowed border-border/50 bg-card/40 opacity-50"
                          : "border-border/70 bg-card/70 active:border-primary/40 active:bg-primary/5"
                      )}
                    >
                      {/* Status circle */}
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                        isCurrent
                          ? "bg-muted text-muted-foreground"
                          : "border border-border/70 bg-card/50"
                      )}>
                        {isCurrent ? (
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
                          {isCurrent && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">·</span>
                              <Badge variant="secondary" className="h-4 rounded px-1.5 text-[10px]">
                                Current
                              </Badge>
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

        <div className="mt-2 border-t border-border/40 pt-2">
          <button
            type="button"
            className="w-full py-2 text-sm font-medium text-muted-foreground transition-colors active:text-foreground"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
