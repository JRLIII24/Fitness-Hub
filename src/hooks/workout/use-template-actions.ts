"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveWorkout, Exercise, WorkoutSet } from "@/types/workout";
import type { TemplateSnapshot } from "@/hooks/use-shared-items";
import { useWorkoutStore } from "@/stores/workout-store";

export type WorkoutTemplate = {
  id: string;
  name: string;
  primary_muscle_group: string | null;
};

interface TemplateActionsDeps {
  supabase: SupabaseClient;
  userId: string | null;
  loadTemplates: (uid: string) => Promise<void>;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  setLikedTemplateIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadWorkoutForEdit: (workout: ActiveWorkout, sessionId: string) => void;
  addExercise: (exercise: Exercise) => void;
  updateSet: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  addSet: (exerciseIndex: number) => void;
  setSendingTemplate: (template: {
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null) => void;
  setSendDialogOpen: (open: boolean) => void;
}

export function useTemplateActions(deps: TemplateActionsDeps) {
  const {
    supabase,
    userId,
    loadTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    setLikedTemplateIds,
    loadWorkoutForEdit,
    addExercise,
    updateSet,
    addSet,
    setSendingTemplate,
    setSendDialogOpen,
  } = deps;

  const [templateActionBusyId, setTemplateActionBusyId] = useState<string | null>(null);

  async function handleSendTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: templateExercises, error } = await supabase
        .from("template_exercises")
        .select("exercise_id,target_sets,target_reps,target_weight_kg,exercises(name,muscle_group)")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const exercises: TemplateSnapshot["exercises"] = (templateExercises ?? []).map((row) => {
        const exercise = row.exercises as { name?: string; muscle_group?: string } | null;
        const setCount = Math.max(1, row.target_sets ?? 1);
        const reps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;
        return {
          exercise_id: row.exercise_id ?? null,
          name: exercise?.name ?? "Exercise",
          muscle_group: exercise?.muscle_group ?? "full_body",
          sets: Array.from({ length: setCount }, () => ({
            reps: Number.isFinite(reps as number) ? reps : null,
            weight_kg: row.target_weight_kg ?? null,
          })),
        };
      });

      setSendingTemplate({
        id: template.id,
        name: template.name,
        description: null,
        exercises,
      });
      setSendDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare template send.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleEditTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: templateExercises, error } = await supabase
        .from("template_exercises")
        .select(
          "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
        )
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const designWorkout: ActiveWorkout = {
        id: `template-design-${template.id}`,
        name: template.name,
        template_id: template.id,
        started_at: new Date().toISOString(),
        exercises: [],
        notes: "",
        workout_type: null,
      };

      loadWorkoutForEdit(designWorkout, `template-design-${template.id}`);

      for (const row of templateExercises ?? []) {
        const exercise = row.exercises as unknown as Exercise | null;
        if (!exercise) continue;

        addExercise(exercise);
        const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
        if (!exerciseIndex) continue;
        const index = exerciseIndex - 1;
        const setsToCreate = Math.max(1, row.target_sets ?? 1);
        const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;

        updateSet(index, 0, {
          reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
          weight_kg: row.target_weight_kg ?? null,
          rest_seconds: row.rest_seconds ?? 90,
        });

        for (let i = 1; i < setsToCreate; i += 1) {
          addSet(index);
          updateSet(index, i, {
            reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            weight_kg: row.target_weight_kg ?? null,
            rest_seconds: row.rest_seconds ?? 90,
          });
        }
      }

      toast.success(`Editing ${template.name} in design mode`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open template editor.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleCopyTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: sourceRows, error: sourceError } = await supabase
        .from("template_exercises")
        .select("exercise_id,sort_order,target_sets,target_reps,target_weight_kg,rest_seconds")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (sourceError) throw sourceError;

      const { data: createdTemplate, error: createError } = await supabase
        .from("workout_templates")
        .insert({
          user_id: userId,
          name: `${template.name} Copy`,
          description: `Copied from ${template.name}`,
        })
        .select("id")
        .single();

      if (createError || !createdTemplate) throw createError ?? new Error("Template copy failed.");

      if ((sourceRows ?? []).length > 0) {
        const copiedRows = (sourceRows ?? []).map((row) => ({
          template_id: createdTemplate.id,
          exercise_id: row.exercise_id,
          sort_order: row.sort_order,
          target_sets: row.target_sets,
          target_reps: row.target_reps,
          target_weight_kg: row.target_weight_kg,
          rest_seconds: row.rest_seconds,
        }));

        const { error: copyRowsError } = await supabase.from("template_exercises").insert(copiedRows);
        if (copyRowsError) throw copyRowsError;
      }

      await loadTemplates(userId);
      toast.success("Template copied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy template.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleDeleteTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;

    setTemplateActionBusyId(template.id);
    try {
      await supabase.from("template_exercises").delete().eq("template_id", template.id);

      const { error } = await supabase
        .from("workout_templates")
        .delete()
        .eq("id", template.id)
        .eq("user_id", userId);
      if (error) throw error;

      if (selectedTemplateId === template.id) {
        setSelectedTemplateId("none");
      }
      setLikedTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });

      await loadTemplates(userId);
      toast.success("Template deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete template.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  return {
    templateActionBusyId,
    handleSendTemplate,
    handleEditTemplate,
    handleCopyTemplate,
    handleDeleteTemplate,
  };
}
