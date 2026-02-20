"use client";

import { useState, useMemo } from "react";
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
                            <img
                              src={mediaUrl}
                              alt={ex.name}
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
                        Weight (kg)
                      </Label>
                      <Input
                        id={`weight-${idx}`}
                        type="number"
                        step="0.5"
                        placeholder="Weight"
                        value={set.weight_kg ?? ""}
                        onChange={(e) =>
                          updateSet(idx, "weight_kg", e.target.value ? parseFloat(e.target.value) : null)
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
