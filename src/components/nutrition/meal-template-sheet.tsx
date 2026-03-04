"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SavedMealsList } from "@/components/nutrition/saved-meals-list";
import type { FoodItem, MealTemplate, MealTemplateItem } from "@/types/nutrition";

// Accept the shape used by the nutrition page (with nested food_items)
export interface NutritionPageEntry {
  id: string;
  food_item_id: string;
  meal_type: string;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

export function MealTemplateSheet({
  open,
  onOpenChange,
  currentEntries,
  onLoadTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEntries: NutritionPageEntry[];
  onLoadTemplate: (items: MealTemplateItem[]) => void;
}) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/meal-templates");
      if (res.ok) {
        const json = (await res.json()) as { data: MealTemplate[] };
        setTemplates(json.data);
      }
    } catch {
      toast.error("Failed to load saved meals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleSave = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Enter a name for the meal template");
      return;
    }
    if (currentEntries.length === 0) {
      toast.error("No food entries to save");
      return;
    }

    setSaving(true);
    try {
      const items: MealTemplateItem[] = currentEntries.map((entry) => {
        const fi = entry.food_items;
        return {
          food_item_id: entry.food_item_id ?? null,
          name: fi?.name ?? entry.food_name ?? "Unknown",
          brand: fi?.brand ?? entry.food_brand ?? null,
          servings: entry.servings,
          calories: fi?.calories_per_serving ?? entry.calories_consumed ?? 0,
          protein_g: fi?.protein_g ?? entry.protein_g ?? null,
          carbs_g: fi?.carbs_g ?? entry.carbs_g ?? null,
          fat_g: fi?.fat_g ?? entry.fat_g ?? null,
          serving_description: fi?.serving_description ?? entry.serving_description ?? null,
        };
      });

      const res = await fetch("/api/nutrition/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });

      if (res.ok) {
        toast.success("Meal template saved!");
        setTemplateName("");
        await fetchTemplates();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/nutrition/meal-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleUse = (template: MealTemplate) => {
    onLoadTemplate(template.items);
    onOpenChange(false);
    toast.success(`Loaded "${template.name}" into your log`);
  };

  const previewCalories = currentEntries.reduce((sum, e) => {
    const cal = e.food_items?.calories_per_serving ?? e.calories_consumed ?? 0;
    return sum + cal * e.servings;
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-bold">Saved Meals</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="load" className="mt-2 px-4 pb-4">
          <TabsList className="w-full">
            <TabsTrigger value="load" className="flex-1">
              Load
            </TabsTrigger>
            <TabsTrigger value="save" className="flex-1">
              Save Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load" className="mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SavedMealsList
                templates={templates}
                onUse={handleUse}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>

          <TabsContent value="save" className="mt-3 space-y-4">
            {currentEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] font-semibold">Nothing to save</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Log some food first, then save it as a template.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Template Name
                  </label>
                  <Input
                    placeholder="e.g. Monday Breakfast"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview ({currentEntries.length} item
                    {currentEntries.length !== 1 ? "s" : ""} &middot;{" "}
                    {Math.round(previewCalories)} kcal)
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {currentEntries.map((entry) => {
                      const name =
                        entry.food_items?.name ??
                        entry.food_name ??
                        "Unknown";
                      const cal =
                        (entry.food_items?.calories_per_serving ??
                          entry.calories_consumed ??
                          0) * entry.servings;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="min-w-0 truncate text-foreground">
                            {name}
                            {entry.servings !== 1 && (
                              <span className="ml-1 text-muted-foreground">
                                x{entry.servings}
                              </span>
                            )}
                          </span>
                          <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                            {Math.round(cal)} kcal
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || !templateName.trim()}
                  className="w-full gap-2"
                  size="sm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
