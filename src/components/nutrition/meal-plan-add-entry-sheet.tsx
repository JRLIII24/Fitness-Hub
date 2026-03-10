"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MealPlanDayEntry, MealType } from "./meal-plan-calendar";

interface MealPlanAddEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  dayOfWeek: number;
  mealType: MealType;
  dayLabel: string;
  onEntryAdded: (entry: MealPlanDayEntry) => void;
}

interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_description: string | null;
}

interface MealTemplate {
  id: string;
  name: string;
  total_calories: number;
  total_protein_g: number;
  items: Array<{
    food_item_id?: string;
    name: string;
    servings: number;
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  }>;
}

export function MealPlanAddEntrySheet({
  open,
  onOpenChange,
  planId,
  dayOfWeek,
  mealType,
  dayLabel,
  onEntryAdded,
}: MealPlanAddEntrySheetProps) {
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [servings, setServings] = useState("1");
  const [adding, setAdding] = useState(false);

  // Custom entry state
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");

  // Saved meals state
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  const searchFood = async (q: string) => {
    if (q.length < 2) { setFoodResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setFoodResults(data.items ?? data ?? []);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const addEntry = async (body: Record<string, unknown>) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/nutrition/meal-plan/${planId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, day_of_week: dayOfWeek, meal_type: mealType }),
      });
      if (!res.ok) throw new Error("Failed to add");
      const { entry } = await res.json();
      onEntryAdded(entry);
      onOpenChange(false);
      // Reset state
      setSelectedFood(null);
      setFoodQuery("");
      setFoodResults([]);
      setCustomName("");
      setCustomCalories("");
      setCustomProtein("");
      setCustomCarbs("");
      setCustomFat("");
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const loadTemplates = async () => {
    if (templatesLoaded) return;
    const res = await fetch("/api/nutrition/meal-templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data ?? []);
      setTemplatesLoaded(true);
    }
  };

  const addFromTemplate = async (template: MealTemplate) => {
    setAdding(true);
    try {
      for (const item of template.items) {
        await fetch(`/api/nutrition/meal-plan/${planId}/days`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_of_week: dayOfWeek,
            meal_type: mealType,
            food_item_id: item.food_item_id ?? null,
            custom_name: item.name,
            servings: item.servings,
            calories: item.calories,
            protein_g: item.protein_g ?? null,
            carbs_g: item.carbs_g ?? null,
            fat_g: item.fat_g ?? null,
          }),
        });
      }
      // Parent should reload; for now just close
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">
            Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)} &middot; {dayLabel}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="search">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="search" className="flex-1 text-xs">Food Items</TabsTrigger>
            <TabsTrigger value="meals" className="flex-1 text-xs" onClick={loadTemplates}>Saved Meals</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
          </TabsList>

          {/* Food Item Search */}
          <TabsContent value="search" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search foods..."
                value={foodQuery}
                onChange={(e) => {
                  setFoodQuery(e.target.value);
                  void searchFood(e.target.value);
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {searchLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!selectedFood ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {foodResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFood(f)}
                    className="w-full rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-left hover:bg-card/60 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.brand && <span>{f.brand} &middot; </span>}
                      {f.calories_per_serving != null ? `${f.calories_per_serving} kcal/serving` : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <p className="text-sm font-medium">{selectedFood.name}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedFood.calories_per_serving} kcal/serving</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground">Servings</label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="h-8 w-24 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFood(null)}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    disabled={adding}
                    onClick={() => addEntry({
                      food_item_id: selectedFood.id,
                      custom_name: selectedFood.name,
                      servings: parseFloat(servings) || 1,
                      calories: (selectedFood.calories_per_serving ?? 0) * (parseFloat(servings) || 1),
                      protein_g: selectedFood.protein_g != null ? selectedFood.protein_g * (parseFloat(servings) || 1) : null,
                      carbs_g: selectedFood.carbs_g != null ? selectedFood.carbs_g * (parseFloat(servings) || 1) : null,
                      fat_g: selectedFood.fat_g != null ? selectedFood.fat_g * (parseFloat(servings) || 1) : null,
                    })}
                  >
                    {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add to Plan"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Saved Meal Templates */}
          <TabsContent value="meals" className="space-y-2 max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No saved meals yet.</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addFromTemplate(t)}
                  disabled={adding}
                  className="w-full rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-left hover:bg-card/60 transition-colors"
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Math.round(t.total_calories)} kcal &middot; {Math.round(t.total_protein_g)}g protein
                  </p>
                </button>
              ))
            )}
          </TabsContent>

          {/* Custom Item */}
          <TabsContent value="custom" className="space-y-3">
            <Input
              placeholder="Food name *"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="h-9 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Calories" type="number" value={customCalories} onChange={(e) => setCustomCalories(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Protein (g)" type="number" value={customProtein} onChange={(e) => setCustomProtein(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Carbs (g)" type="number" value={customCarbs} onChange={(e) => setCustomCarbs(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Fat (g)" type="number" value={customFat} onChange={(e) => setCustomFat(e.target.value)} className="h-9 text-sm" />
            </div>
            <Button
              size="sm"
              disabled={!customName.trim() || adding}
              onClick={() => addEntry({
                custom_name: customName.trim(),
                servings: 1,
                calories: parseFloat(customCalories) || null,
                protein_g: parseFloat(customProtein) || null,
                carbs_g: parseFloat(customCarbs) || null,
                fat_g: parseFloat(customFat) || null,
              })}
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add to Plan"}
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
