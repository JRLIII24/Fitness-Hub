"use client";

import { useState } from "react";
import { X, Check, Loader2, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem, MealType } from "@/types/nutrition";

const mealOptions: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

const servingOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function FoodLogForm({
  food,
  initialMeal,
  onSuccess,
  onCancel,
}: {
  food: FoodItem;
  initialMeal: MealType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState(1);
  const [customServings, setCustomServings] = useState("");
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [loading, setLoading] = useState(false);
  const supabase = useSupabase();

  async function ensurePersistedFoodItemId() {
    if (!food.id.startsWith("off-")) return food.id;

    const payload = {
      barcode: food.barcode ?? null,
      name: food.name,
      brand: food.brand ?? null,
      serving_size_g: food.serving_size_g ?? null,
      serving_description: food.serving_description ?? null,
      calories_per_serving: food.calories_per_serving,
      protein_g: food.protein_g ?? null,
      carbs_g: food.carbs_g ?? null,
      fat_g: food.fat_g ?? null,
      fiber_g: food.fiber_g ?? null,
      sugar_g: food.sugar_g ?? null,
      sodium_mg: food.sodium_mg ?? null,
      source: food.source ?? "openfoodfacts",
    };

    if (payload.barcode) {
      const { data, error } = await supabase
        .from("food_items")
        .upsert(payload, { onConflict: "barcode" })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("Could not persist food item");
      return data.id;
    }

    const { data, error } = await supabase
      .from("food_items")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) throw error ?? new Error("Could not persist food item");
    return data.id;
  }

  const displayServings = customServings ? parseFloat(customServings) : servings;

  const calculatedCalories = Math.round(food.calories_per_serving * displayServings);
  const calculatedProtein = food.protein_g != null ? Math.round(food.protein_g * displayServings * 10) / 10 : null;
  const calculatedCarbs = food.carbs_g != null ? Math.round(food.carbs_g * displayServings * 10) / 10 : null;
  const calculatedFat = food.fat_g != null ? Math.round(food.fat_g * displayServings * 10) / 10 : null;

  async function handleLog() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be signed in to log food.");
        return;
      }

      const foodItemId = await ensurePersistedFoodItemId();

      const { error } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItemId,
        meal_type: meal,
        servings: displayServings,
        calories_consumed: calculatedCalories,
        protein_g: calculatedProtein,
        carbs_g: calculatedCarbs,
        fat_g: calculatedFat,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`${food.name} logged to ${meal}!`);
      onSuccess();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to log food. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{food.name}</p>
          {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
        </div>
        <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Serving size selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Servings</Label>
        <div className="flex flex-wrap gap-2">
          {servingOptions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setServings(s);
                setCustomServings("");
              }}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                servings === s && !customServings
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            placeholder="Custom"
            value={customServings}
            onChange={(e) => {
              setCustomServings(e.target.value);
              if (e.target.value) setServings(1);
            }}
            className="h-9 text-sm"
          />
          <span className="flex items-center text-sm text-muted-foreground px-2">servings</span>
        </div>
      </div>

      {/* Calories preview */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Calories</span>
          <span className="text-lg font-bold text-foreground">{calculatedCalories} kcal</span>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {calculatedProtein != null && (
            <span><span className={MACRO_COLORS.protein}>P</span> {calculatedProtein}g</span>
          )}
          {calculatedCarbs != null && (
            <span><span className={MACRO_COLORS.carbs}>C</span> {calculatedCarbs}g</span>
          )}
          {calculatedFat != null && (
            <span><span className={MACRO_COLORS.fat}>F</span> {calculatedFat}g</span>
          )}
        </div>
      </div>

      {/* Meal type */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Meal</Label>
        <Select value={meal} onValueChange={(v) => setMeal(v as MealType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mealOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <opt.icon className="size-3.5" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleLog} disabled={loading} className="w-full gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Log Food
      </Button>
    </div>
  );
}
