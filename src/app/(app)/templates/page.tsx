"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2, Send, Plus, Heart, Play, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditTemplateDialog } from "@/components/workout/edit-template-dialog";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { useTemplateFavorites } from "@/hooks/use-template-favorites";
import { getMuscleColor } from "@/lib/muscle-colors";
import { stripImportFingerprint } from "@/lib/template-utils";
import { TrainSubNav } from "@/components/layout/train-sub-nav";

interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  estimated_duration_min: number | null;
  primary_muscle_group: string | null;
  training_block: string | null;
  save_count?: number;
  created_at?: string;
  updated_at?: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState<{ id: string; name: string; description: string | null; exercises: TemplateSnapshot["exercises"] } | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [lastPerformedMap, setLastPerformedMap] = useState<Record<string, string>>({});

  const { sendTemplate } = useSharedItems(currentUserId);
  const { favoriteIds, toggleFavorite } = useTemplateFavorites(currentUserId);

  // Group templates by training_block; null block → "Other" pinned at the bottom
  const groupedTemplates = useMemo(() => {
    const map = new Map<string, WorkoutTemplate[]>();
    for (const t of templates) {
      const key = t.training_block ?? "__other__";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    // Move "Other" to the end
    const other = map.get("__other__");
    map.delete("__other__");
    const sorted = new Map(
      [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
    if (other) sorted.set("__other__", other);
    return sorted;
  }, [templates]);

  async function handleCreateNew() {
    if (!currentUserId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("workout_templates")
        .insert({
          user_id: currentUserId,
          name: "New Template",
          description: null,
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/templates/${data.id}/edit`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create template");
      setCreating(false);
    }
  }

  useEffect(() => {
    async function loadTemplates() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;
        setCurrentUserId(user.id);

        const { data, error } = await supabase
          .from("workout_templates")
          .select("*")
          .eq("user_id", user.id)
          .is("program_id", null)
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Failed to load templates:", error);
          toast.error("Failed to load templates");
          return;
        }

        const loaded = (data ?? []) as WorkoutTemplate[];
        setTemplates(loaded);

        // Load last-performed dates from the view (migration 053)
        if (loaded.length > 0) {
          const { data: lpData } = await supabase
            .from("template_last_performed")
            .select("template_id, last_performed_at")
            .in("template_id", loaded.map((t) => t.id));

          const lpMap: Record<string, string> = {};
          for (const row of lpData ?? []) {
            if (row.template_id && row.last_performed_at) {
              lpMap[row.template_id] = row.last_performed_at;
            }
          }
          setLastPerformedMap(lpMap);
        }
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, [supabase]);

  async function handleSendOpen(template: WorkoutTemplate) {
    // Fetch exercises for the snapshot
    const { data: exData } = await supabase
      .from("template_exercises")
      .select(`exercise_id, sort_order, exercises(name, muscle_group), template_exercise_sets(reps, weight_kg)`)
      .eq("template_id", template.id)
      .order("sort_order");

    const exercises: TemplateSnapshot["exercises"] = (exData ?? []).map((te) => {
      const exRelation = te.exercises as unknown as { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null;
      const ex = Array.isArray(exRelation) ? exRelation[0] : exRelation;
      const sets = Array.isArray(te.template_exercise_sets) ? te.template_exercise_sets : [];
      return {
        exercise_id: te.exercise_id,
        name: ex?.name ?? "Unknown",
        muscle_group: ex?.muscle_group ?? "",
        sets: sets.map((s) => ({ reps: s.reps, weight_kg: s.weight_kg })),
      };
    });

    setSendingTemplate({ id: template.id, name: template.name, description: template.description, exercises });
    setSendDialogOpen(true);
  }

  async function handleEditOpen(template: WorkoutTemplate) {
    setEditingTemplate(template);
    setEditDialogOpen(true);
  }

  async function handleEditSave(updates: { name: string; description: string | null; primary_muscle_group: string | null; training_block: string | null }) {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({
          name: updates.name,
          description: updates.description,
          primary_muscle_group: updates.primary_muscle_group,
          training_block: updates.training_block,
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, name: updates.name, description: updates.description, primary_muscle_group: updates.primary_muscle_group, training_block: updates.training_block }
            : t
        )
      );

      toast.success("Template updated");
      setEditDialogOpen(false);
      setEditingTemplate(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update template");
    }
  }

  async function handleDeleteConfirmed(templateId: string) {
    setDeleteConfirmId(null);
    setDeletingId(templateId);
    try {
      // Safety: preserve workout history even if DB FK was previously configured as CASCADE.
      const { error: detachSessionsError } = await supabase
        .from("workout_sessions")
        .update({ template_id: null })
        .eq("template_id", templateId);

      if (detachSessionsError) throw detachSessionsError;

      // Delete template exercises first (due to FK constraint)
      const { error: exercisesError } = await supabase
        .from("template_exercises")
        .delete()
        .eq("template_id", templateId);

      if (exercisesError) throw exercisesError;

      // Then delete template
      const { error } = await supabase
        .from("workout_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success("Template deleted. Workout history was preserved.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 pb-28">
        <TrainSubNav />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your saved workout templates
          </p>
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 pb-28">
      <TrainSubNav />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your saved workout templates
          </p>
        </div>
        <Button onClick={handleCreateNew} disabled={creating || !currentUserId} className="shrink-0 gap-1.5">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap &quot;New Template&quot; to build one, or save a workout to create one automatically
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedTemplates.entries()).map(([blockKey, blockTemplates]) => {
            const blockLabel = blockKey === "__other__" ? "Other" : blockKey;
            return (
              <div key={blockKey} className="space-y-3">
                {groupedTemplates.size > 1 && (
                  <h2 className="text-[13px] font-bold text-foreground uppercase tracking-widest">
                    {blockLabel}
                  </h2>
                )}
                {blockTemplates.map((template) => {
                  const gc = template.primary_muscle_group
                    ? getMuscleColor(template.primary_muscle_group)
                    : null;
                  const lastPerformedAt = lastPerformedMap[template.id] ?? null;
                  const daysSince = lastPerformedAt
                    ? Math.floor((Date.now() - new Date(lastPerformedAt).getTime()) / 86_400_000)
                    : null;
                  return (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {gc && template.primary_muscle_group && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                                style={{
                                  background: gc.bgAlpha,
                                  color:      gc.labelColor,
                                  border:     `1px solid ${gc.borderAlpha}`,
                                }}
                              >
                                {template.primary_muscle_group.replace(/_/g, " ")}
                              </span>
                            )}
                            {/* Last-performed badge */}
                            <Badge
                              variant="outline"
                              className={
                                daysSince != null && daysSince > 14
                                  ? "border-amber-500 text-amber-500"
                                  : ""
                              }
                            >
                              {daysSince == null
                                ? "Never done"
                                : daysSince === 0
                                ? "Done today"
                                : `Last done: ${daysSince}d ago`}
                              {daysSince != null && daysSince > 14 ? " ⚠️" : ""}
                            </Badge>
                          </div>
                          {stripImportFingerprint(template.description) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {stripImportFingerprint(template.description)}
                            </p>
                          )}
                          {template.estimated_duration_min && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Est. {template.estimated_duration_min} min
                            </p>
                          )}
                          {(template.save_count ?? 0) > 0 && (
                            <Badge variant="secondary" className="mt-1.5 text-xs px-1.5 py-0">
                              {template.save_count} {template.save_count === 1 ? "athlete" : "athletes"} running this
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleFavorite(template.id)}
                            title={favoriteIds.has(template.id) ? "Remove from favorites" : "Add to favorites"}
                            aria-label={favoriteIds.has(template.id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Heart
                              className={`size-4 ${favoriteIds.has(template.id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendOpen(template)}
                            title="Send to a friend"
                          >
                            <Send className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => router.push(`/workout?from_launcher=1&template_id=${template.id}`)}
                            title="Start workout with this template"
                          >
                            <Play className="size-3.5" />
                            <span className="hidden sm:inline ml-1">Start</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/templates/${template.id}/edit`)}
                            title="Edit exercises"
                          >
                            <Pencil className="size-3.5" />
                            <span className="hidden sm:inline ml-1">Edit Exercises</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditOpen(template)}
                            title="Edit name & details"
                          >
                            <Settings2 className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(template.id)}
                            disabled={deletingId === template.id}
                          >
                            {deletingId === template.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <EditTemplateDialog
        open={editDialogOpen}
        template={editingTemplate ? { ...editingTemplate, training_block: editingTemplate.training_block ?? null } : null}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleEditSave}
      />

      <SendTemplateDialog
        open={sendDialogOpen}
        currentUserId={currentUserId}
        template={sendingTemplate}
        onClose={() => { setSendDialogOpen(false); setSendingTemplate(null); }}
        onSend={async (recipientId, template, message) => {
          await sendTemplate(recipientId, template!, message);
          toast.success("Template sent!");
        }}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your workout history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteConfirmed(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
