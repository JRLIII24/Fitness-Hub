"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2, Send, Plus, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditTemplateDialog } from "@/components/workout/edit-template-dialog";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { useTemplateFavorites } from "@/hooks/use-template-favorites";

interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  estimated_duration_min: number | null;
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
  const [sendingTemplate, setSendingTemplate] = useState<{ id: string; name: string; description: string | null; exercises: TemplateSnapshot["exercises"] } | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const [creating, setCreating] = useState(false);

  const { sendTemplate } = useSharedItems(currentUserId);
  const { favoriteIds, toggleFavorite } = useTemplateFavorites(currentUserId);

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
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Failed to load templates:", error);
          toast.error("Failed to load templates");
          return;
        }

        setTemplates((data ?? []) as WorkoutTemplate[]);
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

  async function handleEditSave(updates: { name: string; description: string | null }) {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({
          name: updates.name,
          description: updates.description,
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, name: updates.name, description: updates.description }
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

  async function handleDelete(templateId: string) {
    if (!confirm("Delete this template? This action cannot be undone.")) return;

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
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    )}
                    {template.estimated_duration_min && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Est. duration: {template.estimated_duration_min} min
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
                      title="Edit template name and description"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
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
          ))}
        </div>
      )}

      <EditTemplateDialog
        open={editDialogOpen}
        template={editingTemplate}
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
    </div>
  );
}
