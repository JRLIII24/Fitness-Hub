"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, Trash2, Plus, Share2 } from "lucide-react";
import { AddExerciseToTemplateDialog } from "@/components/workout/add-exercise-to-template-dialog";
import { Switch } from "@/components/ui/switch";

interface TemplateExercise {
  id: string;
  exercise_id: string;
  sort_order: number;
  exercises: {
    id: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
  } | null;
  template_exercise_sets?: Array<{
    id: string;
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    set_type: "warmup" | "working" | "dropset" | "failure";
    rest_seconds: number | null;
  }>;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  template_exercises: TemplateExercise[];
}

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [togglingShare, setTogglingShare] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);

  useEffect(() => {
    async function loadTemplate() {
      try {
        const { data, error } = await supabase
          .from("workout_templates")
          .select(
            `id,name,description,is_shared,
            template_exercises(
              id,exercise_id,sort_order,
              exercises(id,name,muscle_group,equipment),
              template_exercise_sets(id,set_number,reps,weight_kg,duration_seconds,set_type,rest_seconds)
            )`
          )
          .eq("id", templateId)
          .single();

        if (error) {
          console.error("Failed to load template:", error);
          toast.error("Failed to load template");
          return;
        }

        if (!data) {
          toast.error("Template not found");
          return;
        }

        setTemplate(data as unknown as Template);
        setName(data.name);
        setDescription(data.description || "");
        setIsShared((data as unknown as Template).is_shared ?? false);
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [templateId, supabase]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Template updated");
      router.back();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  async function handleShareToggle(newValue: boolean) {
    setTogglingShare(true);
    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({ is_shared: newValue })
        .eq("id", templateId);
      if (error) throw error;
      setIsShared(newValue);
      toast.success(newValue ? "Template is now public" : "Template is now private");
    } catch {
      toast.error("Failed to update sharing");
    } finally {
      setTogglingShare(false);
    }
  }

  async function handleRemoveExercise(templateExerciseId: string) {
    if (!confirm("Remove this exercise from the template?")) return;

    try {
      // Delete the template exercise and its sets
      const { error } = await supabase
        .from("template_exercises")
        .delete()
        .eq("id", templateExerciseId);

      if (error) throw error;

      setTemplate((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          template_exercises: prev.template_exercises.filter(
            (e) => e.id !== templateExerciseId
          ),
        };
      });

      toast.success("Exercise removed from template");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove exercise");
    }
  }

  async function handleAddExercise(
    exerciseId: string,
    sets: Array<{ reps: number | null; weight_kg: number | null }>
  ) {
    try {
      // Get the next sort order
      const maxSortOrder =
        Math.max(
          ...template!.template_exercises.map((e) => e.sort_order),
          0
        ) + 1;

      // Insert template exercise
      const { data: templateExerciseData, error: teError } = await supabase
        .from("template_exercises")
        .insert({
          template_id: templateId,
          exercise_id: exerciseId,
          sort_order: maxSortOrder,
        })
        .select(
          `id,exercise_id,sort_order,
          exercises(id,name,muscle_group,equipment)`
        )
        .single();

      if (teError) throw teError;

      // Insert sets
      const setRows = sets.map((s, idx) => ({
        template_exercise_id: templateExerciseData.id,
        set_number: idx + 1,
        reps: s.reps,
        weight_kg: s.weight_kg,
        set_type: "working" as const,
      }));

      if (setRows.length > 0) {
        const { error: setsError } = await supabase
          .from("template_exercise_sets")
          .insert(setRows);

        if (setsError) throw setsError;
      }

      // Reload template
      const { data } = await supabase
        .from("workout_templates")
        .select(
          `id,name,description,
          template_exercises(
            id,exercise_id,sort_order,
            exercises(id,name,muscle_group,equipment),
            template_exercise_sets(id,set_number,reps,weight_kg,duration_seconds,set_type,rest_seconds)
          )`
        )
        .eq("id", templateId)
        .single();

      if (data) {
        setTemplate(data as unknown as Template);
      }

      toast.success("Exercise added to template");
      setAddExerciseOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add exercise");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-28">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-2xl font-bold">Edit Template</h1>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-28">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-2xl font-bold">Edit Template</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Template not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-28">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-accent rounded"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold">Edit Template</h1>
      </div>

      {/* Template Details */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Template description..."
              rows={2}
            />
          </div>

          {/* Share toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Share Template</p>
                <p className="text-xs text-muted-foreground">
                  Make this template visible to other users
                </p>
              </div>
            </div>
            <Switch
              checked={isShared}
              onCheckedChange={handleShareToggle}
              disabled={togglingShare}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exercises */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Exercises</h2>
          <Button
            size="sm"
            onClick={() => setAddExerciseOpen(true)}
            variant="outline"
          >
            <Plus className="size-4 mr-1" />
            Add Exercise
          </Button>
        </div>

        {template.template_exercises.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No exercises yet. Add an exercise to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {template.template_exercises.map((te) => (
              <Card key={te.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {te.exercises?.name || "Unknown Exercise"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {te.exercises?.muscle_group}
                        {te.exercises?.equipment && ` • ${te.exercises.equipment}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(te.template_exercise_sets?.length ?? 0)} set
                        {(te.template_exercise_sets?.length ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveExercise(te.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                {(te.template_exercise_sets?.length ?? 0) > 0 && (
                  <CardContent className="space-y-2">
                    {(te.template_exercise_sets || []).map((set) => (
                      <div
                        key={set.id}
                        className="rounded-lg border border-border/60 p-2 text-sm flex items-center justify-between"
                      >
                        <span>
                          Set {set.set_number}:{" "}
                          {set.weight_kg ? `${set.weight_kg}kg` : ""}
                          {set.weight_kg && set.reps && " × "}
                          {set.reps ? `${set.reps}reps` : ""}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Template"
          )}
        </Button>
        <Button variant="outline" onClick={() => router.back()} size="lg">
          Cancel
        </Button>
      </div>

      <AddExerciseToTemplateDialog
        open={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        onAdd={handleAddExercise}
      />
    </div>
  );
}
