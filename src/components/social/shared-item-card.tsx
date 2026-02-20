"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Dumbbell, Salad, BookCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { useRouter } from "next/navigation";
import type { SharedItem, TemplateSnapshot, MealDaySnapshot } from "@/hooks/use-shared-items";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SharedItemCardProps {
  item: SharedItem;
  currentUserId: string;
  onClearInboxItem: (itemId: string) => Promise<void>;
}

export function SharedItemCard({
  item,
  currentUserId,
  onClearInboxItem,
}: SharedItemCardProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const senderName =
    item.sender?.display_name || item.sender?.username || "Someone";
  const isUnread = !item.read_at;

  async function handleSaveTemplate() {
    const snapshot = item.item_snapshot as TemplateSnapshot;
    setSaving(true);
    try {
      let templateName = snapshot.name;
      let templateDescription = snapshot.description;
      let normalizedExercises: Array<{
        exercise_id: string;
        sort_order: number;
        sets: Array<{
          set_number: number;
          reps: number | null;
          weight_kg: number | null;
          set_type: string | null;
          rest_seconds: number | null;
        }>;
      }> = [];

      // Prefer cloning from canonical template data when available.
      if (item.template_id) {
        const { data: source } = await supabase
          .from("workout_templates")
          .select(
            "name, description, template_exercises(exercise_id, sort_order, template_exercise_sets(set_number, reps, weight_kg, set_type, rest_seconds))"
          )
          .eq("id", item.template_id)
          .maybeSingle();

        if (source) {
          templateName = source.name;
          templateDescription = source.description;
          const sourceExercises = Array.isArray(source.template_exercises)
            ? source.template_exercises
            : [];
          normalizedExercises = sourceExercises
            .filter((ex) => !!ex.exercise_id)
            .map((ex) => {
              const sets = Array.isArray(ex.template_exercise_sets)
                ? ex.template_exercise_sets
                : [];
              return {
                exercise_id: ex.exercise_id,
                sort_order: ex.sort_order,
                sets: sets.map((s) => ({
                  set_number: s.set_number,
                  reps: s.reps,
                  weight_kg: s.weight_kg,
                  set_type: s.set_type ?? null,
                  rest_seconds: s.rest_seconds ?? null,
                })),
              };
            });
        }
      }

      // Fallback to snapshot (for legacy shares / deleted source templates).
      if (normalizedExercises.length === 0) {
        for (let i = 0; i < snapshot.exercises.length; i++) {
          const ex = snapshot.exercises[i];
          let exerciseId = ex.exercise_id ?? null;

          if (!exerciseId) {
            const { data: exData } = await supabase
              .from("exercises")
              .select("id")
              .ilike("name", ex.name)
              .limit(1)
              .maybeSingle();
            exerciseId = exData?.id ?? null;
          }

          if (!exerciseId) continue;

          normalizedExercises.push({
            exercise_id: exerciseId,
            sort_order: i + 1,
            sets: ex.sets.map((s, idx) => ({
              set_number: idx + 1,
              reps: s.reps,
              weight_kg: s.weight_kg,
              set_type: "working",
              rest_seconds: null,
            })),
          });
        }
      }

      if (normalizedExercises.length === 0) {
        throw new Error("No exercises available to save");
      }

      // Create new template
      const { data: newTpl, error: tplErr } = await supabase
        .from("workout_templates")
        .insert({
          user_id: currentUserId,
          name: templateName,
          description: templateDescription,
          is_shared: false,
        })
        .select("id")
        .single();

      if (tplErr || !newTpl) throw tplErr ?? new Error("Failed to create");

      // Clone exercises and sets.
      for (const ex of normalizedExercises) {
        const { data: newEx } = await supabase
          .from("template_exercises")
          .insert({
            template_id: newTpl.id,
            exercise_id: ex.exercise_id,
            sort_order: ex.sort_order,
          })
          .select("id")
          .single();

        if (!newEx) continue;

        if (ex.sets.length > 0) {
          await supabase.from("template_exercise_sets").insert(
            ex.sets.map((s) => ({
              template_exercise_id: newEx.id,
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
              set_type: s.set_type ?? "working",
              rest_seconds: s.rest_seconds,
            }))
          );
        }
      }

      toast.success("Template saved to your library!");
      router.push("/templates");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearInbox() {
    setClearing(true);
    try {
      await onClearInboxItem(item.id);
      toast.success("Removed from inbox");
    } catch {
      toast.error("Failed to clear item");
    } finally {
      setClearing(false);
    }
  }

  if (item.item_type === "template") {
    const snapshot = item.item_snapshot as TemplateSnapshot;
    return (
      <Card className={isUnread ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/80"}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{senderName} sent you a workout</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {isUnread && <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1 rounded-lg border border-border/60 bg-background/40 p-3">
            <p className="text-sm font-semibold">{snapshot.name}</p>
            {snapshot.description && (
              <p className="text-xs text-muted-foreground">{snapshot.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {snapshot.exercises.slice(0, 4).map((ex, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {ex.name}
                </Badge>
              ))}
              {snapshot.exercises.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{snapshot.exercises.length - 4} more
                </Badge>
              )}
            </div>
          </div>
          {item.message && (
            <p className="text-xs text-muted-foreground italic">"{item.message}"</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={saving || clearing}
              onClick={handleSaveTemplate}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <BookCopy className="size-3.5" />
              )}
              Save Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={saving || clearing}
              onClick={handleClearInbox}
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Clear Inbox"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // meal_day
  const snapshot = item.item_snapshot as MealDaySnapshot;
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

  return (
    <Card className={isUnread ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/80"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Salad className="size-4 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">{senderName} shared their meals</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.date} ·{" "}
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {isUnread && <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Macro totals */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/40 p-2 text-center text-xs">
          <div>
            <p className="font-semibold">{Math.round(snapshot.totals.calories)}</p>
            <p className="text-muted-foreground">kcal</p>
          </div>
          <div>
            <p className="font-semibold text-blue-400">{Math.round(snapshot.totals.protein_g)}g</p>
            <p className="text-muted-foreground">protein</p>
          </div>
          <div>
            <p className="font-semibold text-yellow-400">{Math.round(snapshot.totals.carbs_g)}g</p>
            <p className="text-muted-foreground">carbs</p>
          </div>
          <div>
            <p className="font-semibold text-pink-400">{Math.round(snapshot.totals.fat_g)}g</p>
            <p className="text-muted-foreground">fat</p>
          </div>
          <div>
            <p className="font-semibold text-emerald-400">{Math.round(snapshot.totals.fiber_g)}g</p>
            <p className="text-muted-foreground">fiber</p>
          </div>
          <div>
            <p className="font-semibold text-rose-400">{Math.round(snapshot.totals.sugar_g ?? 0)}g</p>
            <p className="text-muted-foreground">sugar</p>
          </div>
          <div>
            <p className="font-semibold text-cyan-400">{Math.round(snapshot.totals.sodium_mg ?? 0)}mg</p>
            <p className="text-muted-foreground">sodium</p>
          </div>
        </div>

        {/* Meals breakdown */}
        {mealTypes.map((meal) => {
          const entries = snapshot.meals[meal];
          if (!entries || entries.length === 0) return null;
          return (
            <div key={meal}>
              <p className="text-xs font-medium capitalize text-muted-foreground mb-1">{meal}</p>
              <div className="space-y-0.5">
                {entries.map((entry, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate">{entry.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {Math.round(entry.calories)} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {item.message && (
          <p className="text-xs text-muted-foreground italic">"{item.message}"</p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={clearing}
          onClick={handleClearInbox}
        >
          {clearing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Clear Inbox"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
