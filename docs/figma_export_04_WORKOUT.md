# Fit-Hub — 04_WORKOUT Component Source

---
## src/components/workout/add-exercise-to-template-dialog.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Loader2, X, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCustomExerciseDialog } from "./create-custom-exercise-dialog";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, lbsToKg } from "@/lib/units";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  image_url?: string | null;
  gif_url?: string | null;
  source?: string | null;
}

interface TemplateSet {
  reps: number | null;
  weight_kg: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string, sets: TemplateSet[]) => Promise<void>;
}

function resolveExerciseMediaUrl(
  mediaUrl: string | null | undefined,
  source?: string | null
): string | null {
  if (!mediaUrl) return null;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  if (source === "free-exercise-db") {
    const clean = trimmed.replace(/^\/+/, "");
    return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${clean}`;
  }

  return null;
}

export function AddExerciseToTemplateDialog({ open, onClose, onAdd }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { preference, unitLabel } = useUnitPreferenceStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<TemplateSet[]>([{ reps: 10, weight_kg: null }]);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setExercises([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("id,name,muscle_group,equipment,image_url,gif_url,source")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (error) throw error;
      setExercises(data || []);
    } catch (err) {
      console.error("Failed to search exercises:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd() {
    if (!selectedExercise) return;
    if (sets.some((s) => s.reps === null && s.weight_kg === null)) {
      alert("Each set must have at least reps or weight specified");
      return;
    }

    setSaving(true);
    try {
      await onAdd(selectedExercise.id, sets);
      // Reset form
      setSearchQuery("");
      setSelectedExercise(null);
      setSets([{ reps: 10, weight_kg: null }]);
      setExercises([]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updateSet(index: number, field: "reps" | "weight_kg", value: number | null) {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index));
  }

  function addSet() {
    setSets((prev) => [...prev, { reps: 10, weight_kg: null }]);
  }

  function handleCustomExerciseCreated(exercise: Exercise) {
    // Auto-select the newly created exercise
    setSelectedExercise(exercise);
    setShowCreateDialog(false);
  }

  const toDisplayWeight = (kg: number) =>
    weightToDisplay(kg, preference === "imperial", 1);

  const fromDisplayWeight = (value: number) =>
    preference === "imperial" ? lbsToKg(value) : value;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exercise to Template</DialogTitle>
          </DialogHeader>

        <div className="space-y-4 py-4">
          {!selectedExercise ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="search">Search Exercise</Label>
                <Input
                  id="search"
                  placeholder="e.g. Bench Press, Squat..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateDialog(true)}
              >
                <Sparkles className="size-4 mr-2" />
                Create New Exercise
              </Button>

              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {exercises.length > 0 && (
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <Card
                      key={ex.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelectedExercise(ex)}
                    >
                      <CardContent className="p-3">
                        {(() => {
                          const mediaUrl = resolveExerciseMediaUrl(
                            ex.gif_url ?? ex.image_url,
                            ex.source
                          );
                          return (
                        <div className="flex items-center gap-3">
                          {mediaUrl ? (
                            <Image
                              src={mediaUrl}
                              alt={ex.name}
                              width={48}
                              height={48}
                              unoptimized
                              className="size-12 rounded object-cover bg-muted shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{ex.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ex.muscle_group}
                              {ex.equipment && ` • ${ex.equipment}`}
                            </p>
                          </div>
                        </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!searching && searchQuery && exercises.length === 0 && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No exercises found for &quot;{searchQuery}&quot;
                  </p>
                  <Button
                    variant="default"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Sparkles className="size-4 mr-2" />
                    Create &quot;{searchQuery}&quot;
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{selectedExercise.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedExercise.muscle_group}
                    {selectedExercise.equipment && ` • ${selectedExercise.equipment}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedExercise(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Sets</Label>
                {sets.map((set, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`reps-${idx}`} className="text-xs">
                        Reps
                      </Label>
                      <Input
                        id={`reps-${idx}`}
                        type="number"
                        placeholder="Reps"
                        value={set.reps ?? ""}
                        onChange={(e) =>
                          updateSet(idx, "reps", e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`weight-${idx}`} className="text-xs">
                        Weight ({unitLabel})
                      </Label>
                      <Input
                        id={`weight-${idx}`}
                        type="number"
                        step={preference === "imperial" ? "1" : "0.5"}
                        placeholder="Weight"
                        value={set.weight_kg == null ? "" : toDisplayWeight(set.weight_kg)}
                        onChange={(e) =>
                          updateSet(
                            idx,
                            "weight_kg",
                            e.target.value
                              ? fromDisplayWeight(parseFloat(e.target.value))
                              : null
                          )
                        }
                      />
                    </div>
                    {sets.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSet(idx)}
                        className="h-10"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addSet}
                  className="w-full"
                >
                  <Plus className="size-4 mr-1" />
                  Add Set
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {selectedExercise && (
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Exercise"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <CreateCustomExerciseDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleCustomExerciseCreated}
      />
    </>
  );
}
```

---
## src/components/workout/create-custom-exercise-dialog.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function CreateCustomExerciseDialog({ open, onClose, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    if (!muscleGroup) {
      toast.error("Please select a muscle group");
      return;
    }
    if (!equipment) {
      toast.error("Please select equipment type");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }

    setCreating(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create exercises");
        return;
      }

      // Generate slug from name (simple kebab-case)
      const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      // Insert the custom exercise
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          name: name.trim(),
          slug: `${slug}-${Date.now()}`, // Add timestamp to ensure uniqueness
          muscle_group: muscleGroup,
          equipment: equipment,
          category: category,
          is_custom: true,
          created_by: user.id,
        })
        .select("id, name, muscle_group, equipment")
        .single();

      if (error) throw error;

      toast.success("Custom exercise created!");
      onCreated(data);

      // Reset form
      setName("");
      setMuscleGroup("");
      setEquipment("");
      setCategory("");
      onClose();
    } catch (err) {
      console.error("Failed to create exercise:", err);
      toast.error("Failed to create exercise");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ex-name">Exercise Name *</Label>
            <Input
              id="ex-name"
              placeholder="e.g. Landmine Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="muscle-group">Muscle Group *</Label>
            <Select value={muscleGroup} onValueChange={setMuscleGroup}>
              <SelectTrigger id="muscle-group">
                <SelectValue placeholder="Select muscle group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chest">Chest</SelectItem>
                <SelectItem value="back">Back</SelectItem>
                <SelectItem value="legs">Legs</SelectItem>
                <SelectItem value="shoulders">Shoulders</SelectItem>
                <SelectItem value="arms">Arms</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="full_body">Full Body</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment">Equipment *</Label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger id="equipment">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barbell">Barbell</SelectItem>
                <SelectItem value="dumbbell">Dumbbell</SelectItem>
                <SelectItem value="cable">Cable</SelectItem>
                <SelectItem value="machine">Machine</SelectItem>
                <SelectItem value="bodyweight">Bodyweight</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compound">Compound</SelectItem>
                <SelectItem value="isolation">Isolation</SelectItem>
                <SelectItem value="cardio">Cardio</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Exercise"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## src/components/workout/edit-template-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter(f => f !== "All");

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  primary_muscle_group?: string | null;
  training_block?: string | null;
}

interface Props {
  open: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  onSave: (updates: { name: string; description: string | null; primary_muscle_group: string | null; training_block: string | null }) => Promise<void>;
}

export function EditTemplateDialog({ open, template, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState<string | null>(null);
  const [trainingBlock, setTrainingBlock] = useState("");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setPrimaryMuscleGroup(template.primary_muscle_group ?? null);
      setTrainingBlock(template.training_block ?? "");
    }
  }, [template, open]);

  async function handleSave() {
    if (!name.trim()) {
      alert("Template name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        primary_muscle_group: primaryMuscleGroup,
        training_block: trainingBlock.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this workout..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="training-block">Training Block (optional)</Label>
            <Input
              id="training-block"
              value={trainingBlock}
              onChange={(e) => setTrainingBlock(e.target.value)}
              placeholder="e.g. 6-Week Powerbuilding"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on  = primaryMuscleGroup === val;
                const gc  = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPrimaryMuscleGroup(on ? null : val)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha      : "rgba(255,255,255,0.04)",
                      border:     `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color:      on ? gc.labelColor   : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## src/components/workout/exercise-card.tsx
```tsx
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
              aria-label="Swap exercise"
            >
              <ArrowLeftRight className="size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onRemoveExercise(exerciseIndex)}
              aria-label="Remove exercise"
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
```

---
## src/components/workout/exercise-selection-card.tsx
```tsx
"use client";

import { useState } from "react";
import { ChevronDown, Plus, Zap, TrendingUp, Target } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";

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
  const { preference, unitLabel } = useUnitPreferenceStore();

  const muscleLabel =
    MUSCLE_GROUP_LABELS[exercise.muscle_group as keyof typeof MUSCLE_GROUP_LABELS] ??
    exercise.muscle_group ??
    "General";
  const equipmentLabel =
    (exercise.equipment &&
      EQUIPMENT_LABELS[exercise.equipment as keyof typeof EQUIPMENT_LABELS]) ??
    exercise.equipment ??
    "Bodyweight";

  function formatLastPerformance() {
    if (!previousPerformance) return null;
    const hasWeight = previousPerformance.weight != null;
    const hasReps = previousPerformance.reps != null;
    if (!hasWeight && !hasReps) return null;
    const weight = hasWeight
      ? `${weightToDisplay(previousPerformance.weight ?? 0, preference === "imperial", 1)} ${unitLabel}`
      : "BW";
    const reps = hasReps ? `${previousPerformance.reps}` : "—";
    return `${weight} × ${reps}`;
  }

  function handleRowClick() {
    if (!selected) {
      onSelect();
      setExpanded(true);
    } else {
      setExpanded((v) => !v);
    }
  }

  const lastPerf = formatLastPerformance();

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border transition-all duration-200",
        selected
          ? "border-primary/60 bg-card shadow-[0_0_16px_rgba(255,255,255,0.06)]"
          : "border-border/60 bg-card/50 hover:border-border hover:bg-card/80"
      )}
    >
      {/* ── Main row ── */}
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5">
        {/* Tap area — covers name/badges, not the action buttons */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 focus-visible:outline-none"
        >
          <div
            className={cn(
              "h-8 w-1 shrink-0 rounded-full",
              selected ? "bg-primary" : "bg-border"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {exercise.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="h-4 rounded px-1.5 text-[10px] tracking-wide"
              >
                {muscleLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {equipmentLabel}
              </span>
              {lastPerf && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground">
                    Last:{" "}
                    <span className="font-medium text-foreground/80">{lastPerf}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick add button */}
        <button
          type="button"
          aria-label={`Quick add ${exercise.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          onClick={(e) => {
            e.stopPropagation();
            if (!selected) onSelect();
            setExpanded((v) => !v);
          }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            expanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* ── Expandable details ── */}
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
```

---
## src/components/workout/exercise-sparkline.tsx
```tsx
"use client";

import { memo } from "react";

interface ExerciseSparklineProps {
  weights: number[];
  slope: number;
}

export const ExerciseSparkline = memo(function ExerciseSparkline({
  weights,
  slope,
}: ExerciseSparklineProps) {
  if (weights.length < 2) return null;

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 48;
  const H = 20;

  const pts = weights
    .map(
      (w, i) =>
        `${(i / (weights.length - 1)) * W},${H - ((w - min) / range) * H}`
    )
    .join(" ");

  const color = slope > 0 ? "#22c55e" : slope < 0 ? "#ef4444" : "#6b7280";

  return (
    <svg
      width={W}
      height={H}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
```

---
## src/components/workout/exercise-swap-sheet.tsx
```tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
import { getMuscleColor } from "@/components/marketplace/muscle-colors";
import { cn } from "@/lib/utils";

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

  // Stable seq counter to discard stale responses
  const searchSeq = useRef(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (open && currentExercise) {
      const mg = currentExercise.muscle_group as MuscleGroup;
      setSelectedMuscleGroup(MUSCLE_GROUPS.includes(mg) ? mg : "chest");
      setSearch("");
    }
  }, [open, currentExercise]);

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
              <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
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
```

---
## src/components/workout/form-tips-panel.tsx
```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FormTipsPanelProps {
  exerciseName: string;
  formTips: string[] | null;
}

export function FormTipsPanel({ exerciseName, formTips }: FormTipsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!formTips || formTips.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
          Form Tips
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
          >
            {formTips.length}
          </Badge>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-primary/10 px-3 pb-3 pt-2 space-y-2">
          {formTips.map((tip, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="leading-snug">{tip}</p>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent shrink-0" />
            <span>AI-powered tips for <strong className="text-foreground">{exerciseName}</strong> coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## src/components/workout/plate-calculator.tsx
```tsx
"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { motionDurations, motionEasings } from "@/lib/motion";
import { kgToDisplayValue } from "@/lib/units";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlateCalculatorProps {
  weightKg: number;
}

interface PlateEntry {
  weight: number;
  count: number;
}

interface PlateBreakdown {
  barWeight: number;
  plates: PlateEntry[];
  remainder: number;
}

/* ------------------------------------------------------------------ */
/*  Plate denominations & colors                                       */
/* ------------------------------------------------------------------ */

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LBS_PLATES = [45, 35, 25, 10, 5, 2.5];

const KG_BAR = 20;
const LBS_BAR = 45;

/** Standard plate colors (inline styles per project convention) */
const PLATE_COLORS_KG: Record<number, string> = {
  25: "#dc2626",   // red
  20: "#2563eb",   // blue
  15: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
  1.25: "#d1d5db", // silver
};

const PLATE_COLORS_LBS: Record<number, string> = {
  45: "#dc2626",   // red
  35: "#2563eb",   // blue
  25: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
};

/** Map plate weight to a proportional height (px) for the visual */
const PLATE_HEIGHT_KG: Record<number, number> = {
  25: 80,
  20: 72,
  15: 64,
  10: 54,
  5: 44,
  2.5: 36,
  1.25: 30,
};

const PLATE_HEIGHT_LBS: Record<number, number> = {
  45: 80,
  35: 72,
  25: 64,
  10: 54,
  5: 44,
  2.5: 36,
};

/* ------------------------------------------------------------------ */
/*  Math: greedy plate calculator                                      */
/* ------------------------------------------------------------------ */

export function calculatePlates(
  totalWeight: number,
  unit: "metric" | "imperial",
): PlateBreakdown | null {
  const barWeight = unit === "imperial" ? LBS_BAR : KG_BAR;
  const denominations = unit === "imperial" ? LBS_PLATES : KG_PLATES;

  if (totalWeight <= 0) return null;

  let perSide = (totalWeight - barWeight) / 2;

  if (perSide < 0) {
    return { barWeight, plates: [], remainder: 0 };
  }

  const plates: PlateEntry[] = [];

  for (const denom of denominations) {
    if (perSide >= denom) {
      const count = Math.floor(perSide / denom);
      plates.push({ weight: denom, count });
      perSide -= count * denom;
    }
  }

  // Round remainder to avoid floating-point artifacts
  const remainder = Math.round(perSide * 1000) / 1000;

  return { barWeight, plates, remainder };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlateCalculator({ weightKg }: PlateCalculatorProps) {
  const preference = useUnitPreferenceStore((s) => s.preference);
  const unitLabel = useUnitPreferenceStore((s) => s.unitLabel);

  const displayWeight =
    preference === "imperial"
      ? kgToDisplayValue(weightKg, 1)
      : weightKg;

  if (weightKg <= 0) return null;

  const result = calculatePlates(displayWeight, preference);

  if (!result) return null;

  const colorMap = preference === "imperial" ? PLATE_COLORS_LBS : PLATE_COLORS_KG;
  const heightMap = preference === "imperial" ? PLATE_HEIGHT_LBS : PLATE_HEIGHT_KG;

  const isAtOrBelowBar = result.plates.length === 0 && result.remainder === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionDurations.panel,
        ease: motionEasings.primary as unknown as [number, number, number, number],
      }}
      className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
    >
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Plate Loading
      </p>

      {/* At-or-below-bar message */}
      {isAtOrBelowBar && (
        <p className="text-sm text-muted-foreground">
          Weight is at or below the barbell ({result.barWeight} {unitLabel}).
          Consider dumbbells or a lighter bar.
        </p>
      )}

      {/* Barbell visual + plate chips */}
      {!isAtOrBelowBar && (
        <>
          {/* CSS barbell visualization (one side) */}
          <div className="flex items-center gap-0.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Bar sleeve */}
            <div
              className="h-3 w-10 rounded-l-full"
              style={{ background: "#a1a1aa" }}
            />
            {/* Bar shaft */}
            <div
              className="h-2 w-6"
              style={{ background: "#a1a1aa" }}
            />

            {/* Plates (largest -> smallest, left to right) */}
            {result.plates.map((entry) =>
              Array.from({ length: entry.count }).map((_, i) => (
                <div
                  key={`${entry.weight}-${i}`}
                  className="rounded-sm border border-black/10 flex-shrink-0"
                  style={{
                    width: 14,
                    height: heightMap[entry.weight] ?? 40,
                    background: colorMap[entry.weight] ?? "#6b7280",
                  }}
                />
              )),
            )}

            {/* Bar center */}
            <div
              className="h-2 w-4"
              style={{ background: "#a1a1aa" }}
            />
            <div className="text-[10px] font-medium text-muted-foreground pl-2 whitespace-nowrap">
              per side
            </div>
          </div>

          {/* Chip badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Bar: {result.barWeight} {unitLabel}
            </span>
            {result.plates.map((entry) => (
              <span
                key={entry.weight}
                className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {entry.count}x {entry.weight}
                {unitLabel}
              </span>
            ))}
          </div>

          {/* Remainder warning */}
          {result.remainder > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {result.remainder} {unitLabel} per side cannot be loaded with
                standard plates.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
```

---
## src/components/workout/quick-start-panel.tsx
```tsx
"use client";

import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import { Label } from "@/components/ui/label";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";

interface QuickStartPanelProps {
  presetId: WorkoutPresetId;
  quickFilter: string;
  onQuickFilterChange: (filter: string) => void;
  onPresetChange: (id: WorkoutPresetId) => void;
}

export function QuickStartPanel({
  presetId,
  quickFilter,
  onQuickFilterChange,
  onPresetChange,
}: QuickStartPanelProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <Label
        htmlFor="preset"
        className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
      >
        Choose a Preset
      </Label>

      {/* Marketplace-style filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {MUSCLE_FILTERS.map((f) => {
          const on = quickFilter === f;
          const mgc = f !== "All" ? getMuscleColor(f) : null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onQuickFilterChange(f)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-150"
              style={{
                background: on
                  ? (mgc ? mgc.bgAlpha : "rgba(200,255,0,0.15)")
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${on
                  ? (mgc ? mgc.borderAlpha : "rgba(200,255,0,0.4)")
                  : "rgba(255,255,255,0.08)"}`,
                color: on
                  ? (mgc ? mgc.labelColor : "hsl(var(--primary))")
                  : "hsl(var(--muted-foreground))",
                fontWeight: on ? 700 : 500,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Filtered preset grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POPULAR_WORKOUTS
          .filter((preset) => quickFilter === "All" || preset.category.toLowerCase() === quickFilter.toLowerCase())
          .map((preset) => {
            const gc = getMuscleColor(preset.category);
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetChange(preset.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70 hover:bg-card"
                  }`}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-semibold leading-snug">{preset.defaultName}</p>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                    style={{
                      background: gc.bgAlpha,
                      color: gc.labelColor,
                      border: `1px solid ${gc.borderAlpha}`,
                    }}
                  >
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {preset.liftNames.length} exercises
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {preset.liftNames.slice(0, 2).map((lift) => (
                    <p key={lift} className="truncate text-[10px] text-muted-foreground/90">
                      {"\u2022"} {lift}
                    </p>
                  ))}
                  {preset.liftNames.length > 2 ? (
                    <p className="text-[10px] text-muted-foreground/80">
                      +{preset.liftNames.length - 2} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        <button
          type="button"
          onClick={() => onPresetChange("custom")}
          className={`rounded-xl border px-3 py-2 text-left transition ${presetId === "custom"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-xs font-semibold">Custom</p>
          <p className="text-[10px] text-muted-foreground">Start empty workout</p>
        </button>
      </div>
    </div>
  );
}
```

---
## src/components/workout/rest-timer-pill.tsx
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useTimerStore } from "@/stores/timer-store";
import { Pause, Play, X, Plus, Minus, BellOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestTimerPillProps {
  className?: string;
}

export function RestTimerPill({ className }: RestTimerPillProps) {
  const {
    timers,
    lastTickMs,
    pauseTimer,
    resumeTimer,
    stopTimer,
    adjustTime,
    notificationPermission,
    requestNotificationPermission,
  } = useTimerStore(
    useShallow((s) => ({
      timers: s.timers,
      lastTickMs: s.lastTickMs,
      pauseTimer: s.pauseTimer,
      resumeTimer: s.resumeTimer,
      stopTimer: s.stopTimer,
      adjustTime: s.adjustTime,
      notificationPermission: s.notificationPermission,
      requestNotificationPermission: s.requestNotificationPermission,
    }))
  );

  const [isDone, setIsDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  // Preserve exercise name for the "done" banner after the timer is removed from store
  const lastExerciseNameRef = useRef<string>("");
  // Track previous timer ID to detect store removal vs manual dismiss
  const prevTimerIdRef = useRef<string | null>(null);
  // Set when user taps X so we don't show the "done" splash on manual dismiss
  const manuallyDismissedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Single active timer — store enforces max-one
  const timer = timers[0] ?? null;

  // Keep exercise name fresh while the timer exists
  if (timer) lastExerciseNameRef.current = timer.exerciseName;

  const now = lastTickMs || Date.now();
  const remainingSeconds = timer
    ? Math.max(0, Math.ceil((timer.endTime - now) / 1000))
    : 0;

  // ── Auto-close detection ─────────────────────────────────────────────────
  // The store removes the timer the instant it hits 0. We detect the
  // "had a timer → no timer" transition and show a "Rest Complete" splash
  // for 1.8 s before the overlay fully exits. Manual X-dismiss skips it.
  useEffect(() => {
    const prevId = prevTimerIdRef.current;
    const currentId = timer?.id ?? null;

    if (prevId !== null && currentId === null) {
      if (!manuallyDismissedRef.current && !isDone) {
        setIsDone(true);
        const t = setTimeout(() => setIsDone(false), 1800);
        return () => clearTimeout(t);
      }
      manuallyDismissedRef.current = false;
    }

    prevTimerIdRef.current = currentId;
  }, [timer, isDone]);

  // Request notification permission on first timer start
  useEffect(() => {
    if (!mounted || !timer || hasRequestedPermission) return;
    if (notificationPermission === "default") {
      requestNotificationPermission();
      setHasRequestedPermission(true);
    }
  }, [mounted, timer, hasRequestedPermission, notificationPermission, requestNotificationPermission]);

  // ── Ring geometry ────────────────────────────────────────────────────────
  const SIZE = 132;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const totalSeconds = timer?.totalSeconds ?? 0;
  const progress =
    totalSeconds > 0 ? Math.min(1, (totalSeconds - remainingSeconds) / totalSeconds) : 1;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const ringColor = isDone
    ? "#22c55e"
    : remainingSeconds <= 10
    ? "#ef4444"
    : remainingSeconds <= 30
    ? "#f59e0b"
    : "hsl(var(--primary))";

  const isRunning = timer?.isRunning ?? false;
  const visible = mounted && (timer !== null || isDone);

  function handleDismiss() {
    if (!timer) return;
    manuallyDismissedRef.current = true;
    stopTimer(timer.id);
  }

  // Portal to document.body so `position: fixed` works correctly even when
  // a parent has a CSS transform (e.g. PageTransition's will-change-transform).
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {/* Soft backdrop — pointer-events-none so the workout page stays usable */}
          <motion.div
            key="rest-timer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[89] bg-background/50 backdrop-blur-[2px] pointer-events-none"
          />

          {/* Centered card */}
          <motion.div
            key="rest-timer-card"
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 14, transition: { duration: 0.22 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "fixed left-1/2 top-1/2 z-[90] -translate-x-1/2 -translate-y-1/2",
              "w-[calc(100%-2.5rem)] max-w-[320px]",
              className
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border bg-card shadow-2xl",
                isDone
                  ? "border-green-500/30"
                  : isRunning
                  ? "border-primary/30"
                  : "border-border/60"
              )}
            >
              {/* Running glow strip */}
              <AnimatePresence>
                {isRunning && !isDone && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0 top-0 h-0.5 rounded-t-3xl"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
                    }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {/* ── Done splash ──────────────────────────────────────── */}
                {isDone ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="flex flex-col items-center gap-3 px-6 py-10"
                  >
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 440, damping: 20, delay: 0.05 }}
                    >
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </motion.div>
                    <p className="text-[20px] font-black tracking-tight text-foreground">
                      Rest Complete!
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {lastExerciseNameRef.current}
                    </p>
                  </motion.div>
                ) : (
                  /* ── Active timer ────────────────────────────────────── */
                  <motion.div
                    key="active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center px-5 pb-5 pt-4"
                  >
                    {/* Header: exercise name + dismiss */}
                    <div className="mb-4 flex w-full items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Rest Timer
                        </p>
                        <p className="mt-0.5 truncate text-[14px] font-bold leading-tight text-foreground">
                          {timer?.exerciseName}
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleDismiss}
                        aria-label="Dismiss timer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>

                    {/* Clock ring */}
                    <div className="relative mb-4" style={{ width: SIZE, height: SIZE }}>
                      <svg
                        width={SIZE}
                        height={SIZE}
                        viewBox={`0 0 ${SIZE} ${SIZE}`}
                        style={{ transform: "rotate(-90deg)" }}
                      >
                        {/* Track */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={5.5}
                          opacity={0.1}
                          className="text-foreground"
                        />
                        {/* Progress arc */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={5.5}
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference * (1 - progress)}
                          style={{
                            transition:
                              "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease",
                          }}
                        />
                      </svg>

                      {/* Time + label inside ring */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          role="timer"
                          aria-label={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`}
                          className="tabular-nums text-[34px] font-black leading-none tracking-tight transition-colors duration-300"
                          style={{ color: ringColor }}
                        >
                          {formatTime(remainingSeconds)}
                        </span>
                        <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {isRunning ? "resting" : "paused"}
                        </span>
                      </div>
                    </div>

                    {/* ±15 s adjust */}
                    <div className="mb-3 flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => timer && adjustTime(timer.id, -15)}
                        aria-label="Subtract 15 seconds"
                        className="flex h-9 items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                        <span>15s</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => timer && adjustTime(timer.id, 15)}
                        aria-label="Add 15 seconds"
                        className="flex h-9 items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        <span>15s</span>
                      </motion.button>
                    </div>

                    {/* Pause / Resume */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        if (!timer) return;
                        isRunning ? pauseTimer(timer.id) : resumeTimer(timer.id);
                      }}
                      aria-label={isRunning ? "Pause timer" : "Resume timer"}
                      className={cn(
                        "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all",
                        isRunning
                          ? "border border-primary/20 bg-primary/10 text-primary"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {isRunning ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Resume
                        </>
                      )}
                    </motion.button>

                    {/* Screen-reader announcements at key thresholds */}
                    <span aria-live="polite" aria-atomic="true" className="sr-only">
                      {remainingSeconds === 0
                        ? `${timer?.exerciseName} rest complete`
                        : remainingSeconds === 30 || remainingSeconds === 10
                        ? `${remainingSeconds} seconds remaining`
                        : ""}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notification-denied banner */}
              <AnimatePresence>
                {notificationPermission === "denied" && !isDone && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 border-t border-amber-400/20 bg-amber-400/[0.06] px-4 py-2">
                      <BellOff className="h-3 w-3 shrink-0 text-amber-400" />
                      <span className="text-[10px] leading-snug text-muted-foreground">
                        Notifications blocked — enable in browser settings for alerts.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

---
## src/components/workout/save-template-dialog.tsx
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveTemplateSchema, type SaveTemplateFormData } from "@/lib/schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/template-utils";
import { MUSCLE_FILTERS, getMuscleColor } from "@/components/marketplace/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter((f) => f !== "All");

interface Props {
  open: boolean;
  defaultName?: string;
  defaultCategories?: string[];
  onClose: () => void;
  onSave: (name: string, isPublic: boolean, difficulty: DifficultyLevel, categories: string[]) => Promise<void>;
}

export function SaveTemplateDialog({ open, defaultName = "", defaultCategories = [], onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("grind");
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<SaveTemplateFormData>({
    resolver: zodResolver(saveTemplateSchema),
    defaultValues: { name: defaultName },
  });

  const onSubmit = async (data: SaveTemplateFormData) => {
    setLoading(true);
    try {
      await onSave(data.name.trim(), isPublic, difficulty, categories);
      reset();
      setIsPublic(true);
      setDifficulty("grind");
      setCategories([]);
      onClose();
    } catch (err) {
      setError("name", {
        type: "manual",
        message: err instanceof Error ? err.message : "Failed to save template.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      setIsPublic(true);
      setDifficulty("grind");
      setCategories([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Push Day A"
              autoFocus
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          {/* Category picker — multi-select */}
          <div className="space-y-2">
            <Label>
              Workout Type
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                (select one or more)
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on = categories.includes(val);
                const gc = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategories((prev) =>
                        on ? prev.filter((c) => c !== val) : [...prev, val]
                      );
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha : "rgba(255,255,255,0.04)",
                      border: `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color: on ? gc.labelColor : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty picker */}
          <div className="space-y-2">
            <Label>Difficulty Level</Label>
            <div className="grid gap-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setDifficulty(level.value)}
                  className={`rounded-lg border-2 p-2.5 text-left transition-all ${
                    difficulty === level.value
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-card/20 hover:border-border/60"
                  }`}
                >
                  <p className="font-semibold text-sm">{level.label}</p>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Share to Marketplace</p>
              <p className="text-xs text-muted-foreground">Let others discover and save this workout</p>
            </div>
            <Switch
              id="tpl-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => {
              reset();
              setIsPublic(true);
              setCategories([]);
              onClose();
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---
## src/components/workout/set-row.tsx
```tsx
"use client";

import { memo } from "react";
import { Check, Flame, Ghost, Play, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkoutSet } from "@/types/workout";
import { cn } from "@/lib/utils";
import { REST_PRESETS } from "@/lib/constants";
import { motion } from "framer-motion";
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
  previousSet?: {
    reps: number | null;
    weight: number | null;
  };
  ghostSet?: {
    reps: number | null;
    weight: number | null;
  };
  /** Display-only suggested weight in kg (never written to store) */
  suggestedWeight?: number | null;
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

export const SetRow = memo(function SetRow({
  set,
  previousSet,
  ghostSet,
  suggestedWeight = null,
  autoFocusWeight = false,
  onUpdate,
  onComplete,
  onRemove,
  onStartRest,
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
      onUpdate({ weight_kg: fromDisplay(parsed) });
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

  const handleRirChange = (value: string) => {
    if (value === "") {
      onUpdate({ rir: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate({ rir: Math.max(0, Math.min(10, parsed)) });
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
  const ghostScore =
    ghostSet?.weight != null && ghostSet.reps != null
      ? ghostSet.weight * ghostSet.reps
      : null;
  const ghostWeightPR =
    ghostSet?.weight != null && set.weight_kg != null && set.weight_kg > ghostSet.weight;
  const ghostRepPRAtSameWeight =
    ghostSet?.weight != null &&
    ghostSet?.reps != null &&
    set.weight_kg != null &&
    set.reps != null &&
    set.weight_kg === ghostSet.weight &&
    set.reps > ghostSet.reps;
  const beatGhost = Boolean(ghostWeightPR || ghostRepPRAtSameWeight);
  const ghostPercentage =
    ghostScore != null && currentScore != null && ghostScore > 0
      ? Math.round((currentScore / ghostScore) * 100)
      : null;
  const ghostWeightText = ghostSet?.weight != null ? `${toDisplay(ghostSet.weight)}` : "—";
  const ghostRepsText = ghostSet?.reps != null ? `${ghostSet.reps}` : "—";
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
            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Ghost workout indicator */}
      {ghostSet && !set.completed && (ghostSet.weight != null || ghostSet.reps != null) && (
        <div className="space-y-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-xs">
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
          {suggestedWeight != null && (
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="font-medium text-amber-400/80">Suggested:</span>
              <span className="font-bold tabular-nums text-amber-400">
                {toDisplay(suggestedWeight)} {unitLabel}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)]">
        <div className="space-y-1">
          <label
            htmlFor={`weight-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Weight ({unitLabel})
          </label>
          <Input
            id={`weight-${set.id}`}
            autoFocus={autoFocusWeight}
            type="number"
            inputMode="decimal"
            placeholder={suggestedWeight != null ? String(toDisplay(suggestedWeight)) : "0"}
            value={weightValue}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`reps-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
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
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`rir-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
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
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <p
            id={`rest-label-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Rest
          </p>
          <div className="flex items-center gap-1">
            <Select
              value={String(restSeconds)}
              onValueChange={(value) => onUpdate({ rest_seconds: Number.parseInt(value, 10) })}
            >
              <SelectTrigger className="h-10 w-full" aria-labelledby={`rest-label-${set.id}`}>
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
    </motion.div>
  );
});
```

---
## src/components/workout/smart-launcher-widget.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, ChevronRight, Loader2, Clock } from "lucide-react";
import { logger } from "@/lib/logger";
import { getCachedPrediction, cachePrediction, clearExpiredCache } from "@/lib/launcher-cache";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LauncherPrediction } from "@/types/adaptive";

interface AlternativeTemplate {
  id: string;
  name: string;
  exercise_count: number;
  last_used_at: string;
}

interface LauncherResponse {
  suggested_workout: LauncherPrediction;
  alternative_templates: AlternativeTemplate[];
}

export function SmartLauncherWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<LauncherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    async function fetchLauncher() {
      try {
        // Clear expired cache entries on mount
        clearExpiredCache().catch((e) => logger.error('[Launcher] Cache cleanup failed:', e));

        // Get current user ID from auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          logger.error('[Launcher] No authenticated user');
          setLoading(false);
          return;
        }

        // Check cache first
        const cached = await getCachedPrediction(user.id) as LauncherResponse | null;
        if (cached) {
          logger.log('[Launcher] Serving from cache');
          setData(cached);
          setLoading(false);
        }

        // Fetch from API
        const res = await fetch("/api/workout/launcher");
        if (res.status === 403) {
          // Feature not enabled - hide widget
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load launcher");

        const json = await res.json() as LauncherResponse;

        // Update cache with fresh data
        setData(json);
        await cachePrediction(user.id, json);

        if (!cached) {
          // Only stop loading if we didn't show cached data
          setLoading(false);
        }
      } catch (err) {
        logger.error("Launcher fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    }
    fetchLauncher();
  }, []);

  async function handleStartWorkout(templateId: string | null, accepted: boolean) {
    setStarting(true);
    const startTime = Date.now();

    try {
      // Log acceptance/rejection
      await fetch("/api/workout/launcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          accepted,
          time_to_decision_ms: Date.now() - startTime,
        }),
      });

      // For saved templates: pass template_id in URL
      if (templateId) {
        router.push(`/workout?template_id=${templateId}&from_launcher=true`);
      } else {
        // For preset workouts: store in sessionStorage
        if (data?.suggested_workout) {
          sessionStorage.setItem('launcher_prediction', JSON.stringify(data.suggested_workout));
        }
        router.push("/workout?from_launcher=true");
      }
    } catch (err) {
      logger.error("Failed to start workout:", err);
      setStarting(false);
    }
  }

  // Hide widget if feature not enabled or error
  if (!loading && (!data || error)) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const { suggested_workout, alternative_templates } = data!;
  const confidence = suggested_workout.confidence;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Launcher
          </CardTitle>
          <Badge
            variant={
              confidence === "high"
                ? "default"
                : confidence === "medium"
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            {confidence === "high" ? "High Match" : confidence === "medium" ? "Good Match" : "Suggested"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">{suggested_workout.template_name}</p>
          <p className="text-xs text-muted-foreground">{suggested_workout.reason}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {suggested_workout.exercises.length} exercises
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{suggested_workout.estimated_duration_mins} min
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => handleStartWorkout(suggested_workout.template_id, true)}
            disabled={starting}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Start Workout
              </>
            )}
          </Button>

          {alternative_templates.length > 0 && (
            <Sheet open={showAlternatives} onOpenChange={setShowAlternatives}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" disabled={starting}>
                  Swap
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Alternative Templates</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {alternative_templates.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => {
                        setShowAlternatives(false);
                        handleStartWorkout(alt.id, false);
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      <p className="font-medium text-sm">{alt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {alt.exercise_count} exercises • Last used{" "}
                        {new Date(alt.last_used_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAlternatives(false);
                      // Log rejection without starting a specific workout
                      fetch("/api/workout/launcher", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          template_id: null,
                          accepted: false,
                          time_to_decision_ms: Date.now() - Date.now(),
                          reason: 'start_from_scratch'
                        }),
                      }).catch(err => logger.error('Failed to log launcher rejection:', err));
                      // Navigate to empty workout page
                      router.push("/workout");
                    }}
                    className="w-full rounded-lg border border-dashed border-border/60 bg-background p-3 text-left transition-colors hover:bg-secondary/30"
                  >
                    <p className="font-medium text-sm flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Start from scratch
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Build a custom workout
                    </p>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## src/components/workout/template-manager-panel.tsx
```tsx
"use client";

import { Send, Pencil, Copy, Trash2, Heart, LayoutList } from "lucide-react";
import { getMuscleColor } from "@/components/marketplace/muscle-colors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WorkoutTemplate } from "@/hooks/workout/use-template-actions";

interface TemplateManagerPanelProps {
  templates: WorkoutTemplate[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  showTemplateManager: boolean;
  templateActionBusyId: string | null;
  likedTemplateIds: Set<string>;
  onToggleManager: () => void;
  onSelectTemplate: (id: string, name: string) => void;
  onSelectStartFresh: () => void;
  onSendTemplate: (template: WorkoutTemplate) => void;
  onEditTemplate: (template: WorkoutTemplate) => void;
  onCopyTemplate: (template: WorkoutTemplate) => void;
  onDeleteTemplate: (template: WorkoutTemplate) => void;
  onToggleLike: (templateId: string) => void;
}

export function TemplateManagerPanel({
  templates,
  loadingTemplates,
  selectedTemplateId,
  showTemplateManager,
  templateActionBusyId,
  likedTemplateIds,
  onToggleManager,
  onSelectTemplate,
  onSelectStartFresh,
  onSendTemplate,
  onEditTemplate,
  onCopyTemplate,
  onDeleteTemplate,
  onToggleLike,
}: TemplateManagerPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="saved-template"
          className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
        >
          Template Selection
        </Label>
        <button
          type="button"
          onClick={onToggleManager}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutList className="size-3" />
          {showTemplateManager ? "Hide Manager" : "Template Manager"}
        </button>
      </div>
      {showTemplateManager ? (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {loadingTemplates ? (
            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
              No templates yet.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-xl border px-3 py-2 transition ${selectedTemplateId === template.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70"
                  }`}
              >
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onSendTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Send
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onEditTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onCopyTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={likedTemplateIds.has(template.id) ? "default" : "secondary"}
                    onClick={() => onToggleLike(template.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Heart className="mr-1 h-3 w-3" />
                    {likedTemplateIds.has(template.id) ? "Liked" : "Like"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSelectStartFresh}
          className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === "none"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-sm font-semibold">Start Fresh</p>
          <p className="text-xs text-muted-foreground">No template preloaded</p>
        </button>
        {loadingTemplates ? (
          <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            No templates yet. Use Template Manager above to create one here.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTemplate(template.id, template.name)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectTemplate(template.id, template.name);
              }}
              className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === template.id
                ? "border-primary/40 bg-primary/10"
                : "border-border/70 bg-card/70 hover:bg-card"
                }`}
            >
              <div className="flex items-start justify-between gap-1 mb-0.5">
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {likedTemplateIds.has(template.id) ? (
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                  ) : null}
                  {template.primary_muscle_group && template.primary_muscle_group.split(",").map((cat) => {
                    const trimmed = cat.trim();
                    const tgc = getMuscleColor(trimmed);
                    return (
                      <span
                        key={trimmed}
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                        style={{ background: tgc.bgAlpha, color: tgc.labelColor, border: `1px solid ${tgc.borderAlpha}` }}
                      >
                        {trimmed}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tap to preload</p>
              <div className="mt-1.5 flex gap-1.5">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${likedTemplateIds.has(template.id)
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    : "border-border/70 text-muted-foreground"
                    }`}
                >
                  <Heart className="h-3 w-3" />
                  Like
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---
## src/components/workout/workout-complete-celebration.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Dumbbell, TrendingUp, X, Star, Zap, Ghost, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

export interface WorkoutStats {
  duration: string; // e.g., "1h 23m"
  exerciseCount: number;
  totalVolume: number;
  unitLabel: "kg" | "lbs";
  prCount: number; // number of PRs hit
  totalSets: number;
  beatGhostCount?: number; // number of exercises where user beat their ghost
  exercises: Array<{
    name: string;
    sets: Array<{
      reps: number | null;
      weight: number | null;
      completed: boolean;
      isPR: boolean;
    }>;
  }>;
}

interface WorkoutCompleteCelebrationProps {
  stats: WorkoutStats;
  onClose: () => void;
  confettiStyle?: "gold" | "regular" | "auto";
}

export function WorkoutCompleteCelebration({
  stats,
  onClose,
  confettiStyle = "auto",
}: WorkoutCompleteCelebrationProps) {
  const [showStats, setShowStats] = useState(false);
  const recapItems = stats.exercises
    .map((exercise) => ({
      name: exercise.name,
      completedSets: exercise.sets.filter((set) => set.completed),
    }))
    .filter((exercise) => exercise.completedSets.length > 0);
  const longRecap =
    recapItems.length > 4 || recapItems.some((exercise) => exercise.completedSets.length > 5);

  const colors =
    confettiStyle === "gold" || (confettiStyle === "auto" && stats.prCount > 0)
      ? ["#FFD700", "#FFA500", "#FBBF24", "#FDE68A"]
      : ["#4D9FFF", "#FCD34D", "#F472B6", "#34D399"];

  useEffect(() => {
    // Stage 1: Radial burst immediately
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Side cannons at 400ms
    const sideCannons = setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });
    }, 400);

    // Stage 3: Show card after 300ms
    const showCard = setTimeout(() => {
      setShowStats(true);
    }, 300);

    return () => {
      clearTimeout(sideCannons);
      clearTimeout(showCard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:items-center sm:p-6">
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-xl"
          >
            <Card className="relative max-h-[min(92dvh,48rem)] overflow-y-auto overflow-x-clip rounded-3xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-2xl sm:p-6">
              {/* Animated surface tint */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Corner glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Header */}
              <div className="relative mb-6 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 18,
                  }}
                  className="mb-3 flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-9 w-9 text-primary-foreground" />
                    {[0, 120, 240].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-full w-full"
                        animate={{ rotate: [deg, deg + 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                      >
                        <Star className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-primary" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs font-bold uppercase tracking-[0.22em] text-primary"
                >
                  Workout Complete
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="mt-1 text-3xl font-black tracking-tight"
                >
                  Session Locked In
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.46 }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Great work today. Here&apos;s your recap.
                </motion.p>
              </div>

              {/* Stats Grid */}
              <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Duration</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">{stats.duration}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Volume</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">
                    {stats.totalVolume.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground sm:text-sm">{stats.unitLabel}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Dumbbell className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Exercises</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.exerciseCount}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Sets</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.totalSets}</p>
                </motion.div>
              </div>

              {/* Workout Recap */}
              <div className="relative mt-6 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workout Recap
                </h3>
                <div
                  className={cn(
                    "space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/40 p-3",
                    longRecap ? "max-h-[min(26dvh,210px)]" : "max-h-[min(32dvh,260px)]"
                  )}
                >
                  {recapItems.map((exercise, exerciseIndex) => (
                    <motion.div
                      key={exercise.name + exerciseIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + exerciseIndex * 0.05 }}
                      className="space-y-1.5"
                    >
                      <p className="truncate text-sm font-semibold">{exercise.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.completedSets.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            className={cn(
                              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition-all",
                              set.isPR
                                ? "border-primary/40 bg-gradient-to-r from-primary/20 to-accent/20 text-primary"
                                : "border-border/70 bg-card/50 text-foreground"
                            )}
                          >
                            {set.weight != null && set.reps != null ? (
                              <>
                                {set.weight}{stats.unitLabel} × {set.reps}
                                {set.isPR && <Trophy className="inline h-3 w-3 ml-1" />}
                              </>
                            ) : set.reps != null ? (
                              `${set.reps} reps`
                            ) : (
                              "Set completed"
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* PR Badge */}
              {stats.prCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-6 rounded-xl border border-primary/35 bg-gradient-to-r from-primary/20 to-accent/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold text-primary">
                      {stats.prCount} Personal Record{stats.prCount > 1 ? "s" : ""}!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re getting stronger! <Trophy className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Ghost Comparison Badge */}
              {stats.beatGhostCount != null && stats.beatGhostCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.0, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-4 rounded-xl border border-accent/45 bg-gradient-to-r from-accent/20 to-primary/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Ghost className="h-5 w-5 text-foreground" />
                    <span className="text-lg font-bold text-foreground">
                      Beat Your Past Self on {stats.beatGhostCount}/{stats.exerciseCount} Exercises!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re making progress! <Flame className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="relative mt-6"
              >
                <Button
                  onClick={onClose}
                  className="motion-press w-full rounded-xl"
                  size="lg"
                >
                  Continue Training
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## src/components/workout/workout-completion-dialog.tsx
```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export interface WorkoutCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionRpeValue: number;
  onSessionRpeChange: (value: number) => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * Post-workout session RPE prompt dialog.
 * Shown after the workout celebration and optional level-up modal close.
 */
export function WorkoutCompletionDialog({
  open,
  onOpenChange,
  sessionRpeValue,
  onSessionRpeChange,
  onSave,
  saving,
}: WorkoutCompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Session Effort</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quick post-session rating. This improves your fatigue estimate.
          </p>
          <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">What is sRPE?</p>
            <p className="mt-1">
              sRPE means <span className="font-semibold">Session Rate of Perceived Exertion</span>:
              how hard the <span className="font-semibold">entire workout</span> felt on a 0-10
              scale.
            </p>
            <p className="mt-1">
              0-2 = very easy, 3-5 = moderate, 6-8 = hard, 9-10 = near max effort.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Session RPE</span>
              <span className="font-semibold tabular-nums">{sessionRpeValue.toFixed(1)}</span>
            </div>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={[sessionRpeValue]}
              onValueChange={(value) => onSessionRpeChange(value[0] ?? 7)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Very easy</span>
              <span>Max effort</span>
            </div>
          </div>
          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Effort"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---
## src/components/workout/workout-header.tsx
```tsx
"use client";

import { memo, useEffect, useState } from "react";
import { Activity, CircleCheck, Clock3, Dumbbell, Layers, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ElapsedTime -- memo-isolated so its 1-second tick does NOT cause the parent
 * WorkoutPage to re-render. startedAt is a stable string for the lifetime of
 * a session, so memo's shallow prop comparison will always bail out.
 */
export const ElapsedTime = memo(function ElapsedTime({
  startedAt,
  className,
}: {
  startedAt: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return <span className={className}>{`${pad(hrs)}:${pad(mins)}:${pad(secs)}`}</span>;
});

export interface WorkoutHeaderProps {
  workoutName: string;
  startedAt: string;
  totalVolumeDisplay: string;
  completedSets: number;
  totalSets: number;
  exerciseCount: number;
  completionProgressPct: number;
  unitLabel: string;
}

/**
 * Active session hero banner with glows, stats badges, and progress bar.
 * Timer is isolated via memo (ElapsedTime) so ticks don't propagate.
 */
export function WorkoutHeader({
  workoutName,
  startedAt,
  totalVolumeDisplay,
  completedSets,
  totalSets,
  exerciseCount,
  completionProgressPct,
  unitLabel,
}: WorkoutHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active Session</p>
            <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">
              {workoutName}
            </h2>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Clock3 className="size-4" />
            <ElapsedTime startedAt={startedAt} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
            <Activity className="mr-1 h-3.5 w-3.5" />
            {totalVolumeDisplay} {unitLabel}
          </Badge>
          <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            <CircleCheck className="mr-1 h-3.5 w-3.5" />
            {completedSets} done
          </Badge>
          <Badge className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-300">
            <Layers className="mr-1 h-3.5 w-3.5" />
            {totalSets} total sets
          </Badge>
          <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-300">
            <Dumbbell className="mr-1 h-3.5 w-3.5" />
            {exerciseCount} exercises
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Session Progress</span>
            <span>{completionProgressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${completionProgressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

