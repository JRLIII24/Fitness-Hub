"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ActiveWorkout, Exercise, WorkoutSet } from "@/types/workout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, Check, Trash2, GripVertical } from "lucide-react";
import { celebratePR, triggerHaptic } from "@/lib/celebrations";

interface WorkoutSession {
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  template_id: string | null;
  workout_sets: Array<{
    id: string;
    exercise_id: string;
    set_number: number;
    set_type: "warmup" | "working" | "dropset" | "failure";
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    rpe: number | null;
    rest_seconds: number | null;
    completed: boolean;
    completed_at: string | null;
    exercises: {
      id: string;
      name: string;
      slug: string;
      muscle_group: string;
      equipment: string | null;
      category: string;
      instructions: string | null;
      form_tips: string[] | null;
      image_url: string | null;
    } | null;
  }>;
}

async function loadWorkout(
  supabase: ReturnType<typeof createClient>,
  workoutId: string
): Promise<{ session: WorkoutSession; activeWorkout: ActiveWorkout } | null> {
  try {
    // Step 1: Fetch workout session
    const { data: sessionData, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id,name,started_at,completed_at,notes,template_id")
      .eq("id", workoutId)
      .single();

    if (sessionError) {
      console.error("Failed to load workout session:", sessionError?.message);
      toast.error(`Failed to load workout: ${sessionError?.message || "Unknown error"}`);
      return null;
    }

    if (!sessionData) {
      console.error("No workout found with ID:", workoutId);
      toast.error("Workout not found");
      return null;
    }

    // Step 2: Fetch workout sets with exercise details
    const { data: setsData, error: setsError } = await supabase
      .from("workout_sets")
      .select(
        "id,exercise_id,set_number,set_type,reps,weight_kg,duration_seconds,rpe,rest_seconds,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
      )
      .eq("session_id", workoutId)
      .order("sort_order", { ascending: true });

    if (setsError) {
      console.error("Failed to load workout sets:", setsError?.message);
      toast.error(`Failed to load workout sets: ${setsError?.message || "Unknown error"}`);
      return null;
    }

    const session = {
      id: sessionData.id,
      name: sessionData.name,
      started_at: sessionData.started_at,
      completed_at: sessionData.completed_at,
      notes: sessionData.notes,
      template_id: sessionData.template_id,
      workout_sets: setsData || [],
    } as unknown as WorkoutSession;

    // Group sets by exercise
    const exerciseMap = new Map<string, Exercise>();
    const setsByExerciseId = new Map<string, any[]>();

    for (const set of session.workout_sets) {
      // Get exercise from the nested exercises object in the set
      if (set.exercises) {
        exerciseMap.set(set.exercise_id, {
          id: set.exercises.id,
          name: set.exercises.name,
          slug: set.exercises.slug,
          muscle_group: set.exercises.muscle_group,
          equipment: set.exercises.equipment,
          category: set.exercises.category,
          instructions: set.exercises.instructions,
          form_tips: set.exercises.form_tips,
          image_url: set.exercises.image_url,
        });
      }

      const existing = setsByExerciseId.get(set.exercise_id) ?? [];
      existing.push(set);
      setsByExerciseId.set(set.exercise_id, existing);
    }

    const exercises = Array.from(
      new Map(
        session.workout_sets.map((set) => [set.exercise_id, set.exercise_id])
      ).entries()
    ).map(([exerciseId]) => {
      const exercise = exerciseMap.get(exerciseId);
      if (!exercise) return null;

      const sets = setsByExerciseId.get(exerciseId) ?? [];
      return {
        exercise,
        sets: sets.map((set) => ({
          id: set.id,
          exercise_id: set.exercise_id,
          set_number: set.set_number,
          set_type: set.set_type,
          reps: set.reps,
          weight_kg: set.weight_kg,
          duration_seconds: set.duration_seconds,
          rpe: set.rpe,
          rest_seconds: set.rest_seconds,
          completed: Boolean(set.completed_at),
          completed_at: set.completed_at,
        })),
        collapsed: false,
        notes: "",
      };
    }).filter(Boolean) as any[];

    const activeWorkout: ActiveWorkout = {
      id: session.id,
      name: session.name,
      template_id: session.template_id,
      started_at: session.started_at,
      exercises,
      notes: session.notes || "",
    };

    return { session, activeWorkout };
  } catch (err) {
    console.error("Error loading workout:", err);
    toast.error("Failed to load workout");
    return null;
  }
}

async function saveWorkoutEdits(
  supabase: ReturnType<typeof createClient>,
  workoutId: string,
  activeWorkout: ActiveWorkout
) {
  // Update workout_sessions
  const { error: sessionError } = await supabase
    .from("workout_sessions")
    .update({
      name: activeWorkout.name,
      notes: activeWorkout.notes,
    })
    .eq("id", workoutId);

  if (sessionError) throw sessionError;

  // Delete old sets
  const { error: deleteError } = await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", workoutId);

  if (deleteError) throw deleteError;

  // Insert new sets
  let sortOrder = 0;
  const setRows = activeWorkout.exercises.flatMap((exerciseBlock) =>
    exerciseBlock.sets.map((set) => {
      sortOrder += 1;
      return {
        session_id: workoutId,
        exercise_id: exerciseBlock.exercise.id,
        set_number: set.set_number,
        set_type: set.set_type,
        reps: set.reps,
        weight_kg: set.weight_kg,
        duration_seconds: set.duration_seconds,
        rpe: set.rpe,
        rest_seconds: set.rest_seconds,
        completed_at: set.completed_at,
        sort_order: sortOrder,
      };
    })
  );

  if (setRows.length > 0) {
    const { error: setsError } = await supabase
      .from("workout_sets")
      .insert(setRows);

    if (setsError) throw setsError;
  }
}

async function hasAnyEditedPR(
  supabase: ReturnType<typeof createClient>,
  workoutId: string,
  activeWorkout: ActiveWorkout
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const exerciseIds = Array.from(
    new Set(activeWorkout.exercises.map((exerciseBlock) => exerciseBlock.exercise.id))
  );
  if (exerciseIds.length === 0) return false;

  const { data: historicalSets, error } = await supabase
    .from("workout_sets")
    .select("exercise_id,reps,weight_kg,workout_sessions!inner(id,user_id,status)")
    .in("exercise_id", exerciseIds)
    .eq("workout_sessions.user_id", user.id)
    .eq("workout_sessions.status", "completed")
    .neq("workout_sessions.id", workoutId)
    .not("reps", "is", null)
    .not("weight_kg", "is", null);

  if (error) {
    console.error("Failed loading historical sets for PR check:", error);
    return false;
  }

  const previousBestByExercise = new Map<string, number>();
  for (const row of historicalSets ?? []) {
    const score = (row.weight_kg ?? 0) * (row.reps ?? 0);
    const currentBest = previousBestByExercise.get(row.exercise_id) ?? 0;
    if (score > currentBest) {
      previousBestByExercise.set(row.exercise_id, score);
    }
  }

  for (const exerciseBlock of activeWorkout.exercises) {
    const previousBest = previousBestByExercise.get(exerciseBlock.exercise.id) ?? 0;
    const currentBest = exerciseBlock.sets.reduce((best, set) => {
      if (!set.completed) return best;
      if (set.reps == null || set.weight_kg == null) return best;
      const score = set.weight_kg * set.reps;
      return score > best ? score : best;
    }, 0);

    if (currentBest > previousBest) {
      return true;
    }
  }

  return false;
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.workoutId as string;

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state for editing
  const [workoutName, setWorkoutName] = useState("");
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const result = await loadWorkout(supabase, workoutId);
      if (!result) {
        toast.error("Failed to load workout");
        router.back();
        return;
      }

      setWorkoutName(result.activeWorkout.name);
      setWorkoutNotes(result.activeWorkout.notes);
      setExercises(result.activeWorkout.exercises);
      setLoading(false);
    }

    load();
  }, [workoutId, supabase, router]);

  const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: string, value: any) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex] = {
      ...newExercises[exerciseIndex].sets[setIndex],
      [field]: value,
    };
    setExercises(newExercises);
  };

  const handleToggleCompleted = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const set = newExercises[exerciseIndex].sets[setIndex];
    set.completed = !set.completed;
    set.completed_at = set.completed ? new Date().toISOString() : null;
    setExercises(newExercises);
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
  };

  const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter(
      (_: any, i: number) => i !== setIndex
    );
    // Renumber remaining sets
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.map((set: any, idx: number) => ({
      ...set,
      set_number: idx + 1,
    }));
    setExercises(newExercises);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const activeWorkout: ActiveWorkout = {
        id: workoutId,
        name: workoutName,
        template_id: null,
        started_at: new Date().toISOString(),
        exercises,
        notes: workoutNotes,
      };

      await saveWorkoutEdits(supabase, workoutId, activeWorkout);
      const hasPR = await hasAnyEditedPR(supabase, workoutId, activeWorkout);
      if (hasPR) {
        celebratePR();
        triggerHaptic("heavy");
      }
      toast.success("Workout updated successfully");
      router.back();
    } catch (err) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
          ? [
              (err as { message: string }).message,
              "details" in err && typeof (err as { details?: unknown }).details === "string"
                ? (err as { details: string }).details
                : null,
              "hint" in err && typeof (err as { hint?: unknown }).hint === "string"
                ? (err as { hint: string }).hint
                : null,
            ]
              .filter(Boolean)
              .join(" ")
          : "Failed to save workout";
      toast.error(message);
      console.error("Failed to save workout edits:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-28">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-2xl font-bold">Edit Workout</h1>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-28">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="p-1 hover:bg-accent rounded">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold">Edit Workout</h1>
      </div>

      {/* Workout Header */}
      <Card>
        <CardHeader>
          <CardTitle>Workout Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workout Name</Label>
            <Input
              id="name"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Workout name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              placeholder="Workout notes..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exercises */}
      {exercises.map((exerciseBlock, exerciseIndex) => (
        <Card key={exerciseIndex}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-lg">{exerciseBlock.exercise.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {exerciseBlock.sets.length} set{exerciseBlock.sets.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveExercise(exerciseIndex)}
                className="shrink-0"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {exerciseBlock.sets.map((set: WorkoutSet, setIndex: number) => (
              <div key={set.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Set {set.set_number}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleCompleted(exerciseIndex, setIndex)}
                      className={`p-1 rounded-md transition-colors ${
                        set.completed
                          ? "bg-green-500/20 text-green-400"
                          : "bg-border/40 text-muted-foreground hover:bg-accent"
                      }`}
                      title="Mark complete"
                    >
                      <Check className="size-4" />
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveSet(exerciseIndex, setIndex)}
                      className="h-8 w-8"
                      title="Remove set"
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`weight-${exerciseIndex}-${setIndex}`} className="text-xs">
                      Weight (kg)
                    </Label>
                    <Input
                      id={`weight-${exerciseIndex}-${setIndex}`}
                      type="number"
                      step="0.5"
                      value={set.weight_kg ?? ""}
                      onChange={(e) =>
                        handleSetUpdate(
                          exerciseIndex,
                          setIndex,
                          "weight_kg",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="Weight"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`reps-${exerciseIndex}-${setIndex}`} className="text-xs">
                      Reps
                    </Label>
                    <Input
                      id={`reps-${exerciseIndex}-${setIndex}`}
                      type="number"
                      value={set.reps ?? ""}
                      onChange={(e) =>
                        handleSetUpdate(
                          exerciseIndex,
                          setIndex,
                          "reps",
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      placeholder="Reps"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Action Buttons */}
      <div className="grid gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        <Button variant="outline" onClick={() => router.back()} size="lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}
