"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem } from "@/types/nutrition";

export function CustomFoodDialog({
  onCreated,
  initialName,
  openSignal,
}: {
  onCreated: (food: FoodItem) => void;
  initialName?: string;
  openSignal?: number;
}) {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  const [servingAmount, setServingAmount] = useState("1");
  const [servingUnit, setServingUnit] = useState<"g" | "ml" | "oz" | "cup">("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sodiumMg, setSodiumMg] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!name && initialName) setName(initialName);
  }, [initialName, open, name]);

  useEffect(() => {
    if (typeof openSignal === "number") {
      setOpen(true);
    }
  }, [openSignal]);

  function parseNumber(value: string): number | null {
    if (!value.trim()) return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  function convertToGrams(amount: number, unit: "g" | "ml" | "oz" | "cup"): number {
    if (unit === "g") return amount;
    if (unit === "ml") return amount; // Approximation: 1 ml ~ 1 g
    if (unit === "oz") return amount * 28.3495;
    return amount * 240; // Approximation: 1 cup ~ 240 ml ~ 240 g
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Food name is required.");
      return;
    }

    const parsedCalories = parseNumber(calories);
    if (parsedCalories === null || parsedCalories < 0) {
      toast.error("Please enter valid calories.");
      return;
    }

    const parsedProtein = parseNumber(protein);
    const parsedCarbs = parseNumber(carbs);
    const parsedFat = parseNumber(fat);
    const parsedFiber = parseNumber(fiber);
    const parsedSodium = parseNumber(sodiumMg);
    const parsedServingAmount = parseNumber(servingAmount);

    const values = [parsedProtein, parsedCarbs, parsedFat, parsedFiber, parsedSodium];
    if (values.some((v) => v !== null && v < 0)) {
      toast.error("Macros and sodium cannot be negative.");
      return;
    }
    if (parsedServingAmount === null || parsedServingAmount <= 0) {
      toast.error("Serving amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to create custom food.");
        return;
      }

      const servingSizeG = Math.round(
        convertToGrams(parsedServingAmount, servingUnit) * 100
      ) / 100;
      const servingDescription = `${parsedServingAmount} ${servingUnit}`;

      const payload = {
        name: trimmedName,
        brand: brand.trim() || null,
        serving_description: servingDescription,
        serving_size_g: servingSizeG,
        calories_per_serving: Math.round(parsedCalories * 100) / 100,
        protein_g: parsedProtein,
        carbs_g: parsedCarbs,
        fat_g: parsedFat,
        fiber_g: parsedFiber,
        sodium_mg: parsedSodium,
        source: "manual",
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("food_items")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) throw error ?? new Error("Failed to create custom food");

      toast.success("Custom food created.");
      onCreated(data as FoodItem);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create custom food.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Create Custom Food
      </Button>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Create Custom Food
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Food name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Brand (optional)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            placeholder="Serving amount"
            value={servingAmount}
            onChange={(e) => setServingAmount(e.target.value)}
          />
          <Select
            value={servingUnit}
            onValueChange={(value) =>
              setServingUnit(value as "g" | "ml" | "oz" | "cup")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">Grams (g)</SelectItem>
              <SelectItem value="ml">Milliliters (ml)</SelectItem>
              <SelectItem value="oz">Ounces (oz)</SelectItem>
              <SelectItem value="cup">Cups</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Calories*"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Protein (g)"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Carbs (g)"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fat (g)"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fiber (g)"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="Sodium (mg)"
            value={sodiumMg}
            onChange={(e) => setSodiumMg(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Use"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
