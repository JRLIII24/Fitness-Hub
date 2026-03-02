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
import { Loader2, ChevronLeft, Trash2, Plus, Globe } from "lucide-react";
import { AddExerciseToTemplateDialog } from "@/components/workout/add-exercise-to-template-dialog";
import { Switch } from "@/components/ui/switch";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

// Category options — all filter values except "All"
const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter(f => f !== "All");

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
  is_public: boolean;
  primary_muscle_group: string | null;
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
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState<string | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const { preference, unitLabel } = useUnitPreferenceStore();

  useEffect(() => {
    async function loadTemplate() {
      try {
        const { data, error } = await supabase
          .from("workout_templates")
          .select(
            `id, name, description, is_public, primary_muscle_group,
            template_exercises(
              id, exercise_id, sort_order,
              exercises(id, name, muscle_group, equipment),
              template_exercise_sets(id, set_number, reps, weight_kg, duration_seconds, set_type, rest_seconds)
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

        const t = data as unknown as Template;
        setTemplate(t);
        setName(t.name);
        setDescription(t.description || "");
        setIsPublic(t.is_public ?? false);
        setPrimaryMuscleGroup(t.primary_muscle_group ?? null);
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
          primary_muscle_group: primaryMuscleGroup,
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

  async function handlePublishToggle(newValue: boolean) {
    // Must have a category set before publishing
    if (newValue && !primaryMuscleGroup) {
      toast.error("Please select a category before publishing to the marketplace.");
      return;
    }
    setTogglingPublic(true);
    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({ is_public: newValue })
        .eq("id", templateId);
      if (error) throw error;
      setIsPublic(newValue);
      toast.success(newValue ? "Template published to marketplace" : "Template removed from marketplace");
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setTogglingPublic(false);
    }
  }

  async function handleRemoveExercise(templateExerciseId: string) {
    if (!confirm("Remove this exercise from the template?")) return;

    try {
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
      const maxSortOrder =
        Math.max(
          ...template!.template_exercises.map((e) => e.sort_order),
          0
        ) + 1;

      const { data: templateExerciseData, error: teError } = await supabase
        .from("template_exercises")
        .insert({
          template_id: templateId,
          exercise_id: exerciseId,
          sort_order: maxSortOrder,
        })
        .select(
          `id, exercise_id, sort_order,
          exercises(id, name, muscle_group, equipment)`
        )
        .single();

      if (teError) throw teError;

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

      const { data } = await supabase
        .from("workout_templates")
        .select(
          `id, name, description, is_public, primary_muscle_group,
          template_exercises(
            id, exercise_id, sort_order,
            exercises(id, name, muscle_group, equipment),
            template_exercise_sets(id, set_number, reps, weight_kg, duration_seconds, set_type, rest_seconds)
          )`
        )
        .eq("id", templateId)
        .single();

      if (data) setTemplate(data as unknown as Template);

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

      {/* ── Template Details ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          {/* ── Category ──────────────────────────────────────────────── */}
          <div className="space-y-2.5">
            <Label>
              Category
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                (required to publish to marketplace)
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on  = primaryMuscleGroup === val;
                const gc  = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPrimaryMuscleGroup(on ? null : val)}
                    className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150"
                    style={{
                      background:   on ? gc.bgAlpha      : "rgba(255,255,255,0.04)",
                      border:       `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color:        on ? gc.labelColor   : "hsl(var(--muted-foreground))",
                      fontWeight:   on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {!primaryMuscleGroup && (
              <p className="text-[11px] text-muted-foreground">
                Select a category so users can find this template by muscle group.
              </p>
            )}
          </div>

          {/* ── Publish to Marketplace ────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Publish to Marketplace</p>
                <p className="text-xs text-muted-foreground">
                  {primaryMuscleGroup
                    ? "Let the community discover and import your template"
                    : "Select a category above to enable publishing"}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handlePublishToggle}
              disabled={togglingPublic || (!isPublic && !primaryMuscleGroup)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Exercises ─────────────────────────────────────────────────── */}
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
                          {set.weight_kg != null
                            ? `${preference === "imperial"
                              ? Math.round(set.weight_kg * 2.20462 * 10) / 10
                              : Math.round(set.weight_kg * 10) / 10
                            } ${unitLabel}`
                            : ""}
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

      {/* ── Action Buttons ────────────────────────────────────────────── */}
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
