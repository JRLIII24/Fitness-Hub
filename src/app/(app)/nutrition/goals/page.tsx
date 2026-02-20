"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GoalValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

interface MacroInfo {
  key: keyof GoalValues;
  label: string;
  unit: string;
  colorClass: string;
  bgClass: string;
  kcalPerG: number | null;
  description: string;
  placeholder: string;
}

const macroInfo: MacroInfo[] = [
  {
    key: "protein",
    label: "Protein",
    unit: "g",
    colorClass: MACRO_COLORS.protein,
    bgClass: MACRO_COLORS.protein.replace("text-", "bg-"),
    kcalPerG: 4,
    description: "4 kcal/g — Builds and preserves muscle, supports recovery",
    placeholder: "e.g. 150",
  },
  {
    key: "carbs",
    label: "Carbohydrates",
    unit: "g",
    colorClass: MACRO_COLORS.carbs,
    bgClass: MACRO_COLORS.carbs.replace("text-", "bg-"),
    kcalPerG: 4,
    description: "4 kcal/g — Primary energy source, fuels training",
    placeholder: "e.g. 200",
  },
  {
    key: "fat",
    label: "Fat",
    unit: "g",
    colorClass: MACRO_COLORS.fat,
    bgClass: MACRO_COLORS.fat.replace("text-", "bg-"),
    kcalPerG: 9,
    description: "9 kcal/g — Hormone production, fat-soluble vitamin absorption",
    placeholder: "e.g. 65",
  },
  {
    key: "fiber",
    label: "Fiber",
    unit: "g",
    colorClass: MACRO_COLORS.fiber,
    bgClass: MACRO_COLORS.fiber.replace("text-", "bg-"),
    kcalPerG: null,
    description: "Target 25–38g/day — Supports gut health and satiety",
    placeholder: "e.g. 30",
  },
];

function MacroBreakdown({ values }: { values: GoalValues }) {
  const protein = parseFloat(values.protein) || 0;
  const carbs = parseFloat(values.carbs) || 0;
  const fat = parseFloat(values.fat) || 0;

  const proteinKcal = protein * 4;
  const carbsKcal = carbs * 4;
  const fatKcal = fat * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;

  const calorieTarget = parseFloat(values.calories) || 0;

  if (totalMacroKcal === 0 && calorieTarget === 0) {
    return null;
  }

  const total = totalMacroKcal || calorieTarget;

  const proteinPct = total > 0 ? (proteinKcal / total) * 100 : 0;
  const carbsPct = total > 0 ? (carbsKcal / total) * 100 : 0;
  const fatPct = total > 0 ? (fatKcal / total) * 100 : 0;

  const macroKcalFromMacros = proteinKcal + carbsKcal + fatKcal;
  const calorieDiff =
    calorieTarget > 0 ? calorieTarget - macroKcalFromMacros : null;
  const hasMismatch =
    calorieDiff !== null && Math.abs(calorieDiff) > calorieTarget * 0.05;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Macro Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {proteinPct > 0 && (
            <div
              className="bg-blue-400 transition-all duration-300"
              style={{ width: `${Math.min(proteinPct, 100)}%` }}
            />
          )}
          {carbsPct > 0 && (
            <div
              className="bg-yellow-400 transition-all duration-300"
              style={{ width: `${Math.min(carbsPct, 100)}%` }}
            />
          )}
          {fatPct > 0 && (
            <div
              className="bg-pink-400 transition-all duration-300"
              style={{ width: `${Math.min(fatPct, 100)}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Protein", pct: proteinPct, kcal: proteinKcal, colorClass: MACRO_COLORS.protein, dotClass: MACRO_COLORS.protein.replace("text-", "bg-") },
            { label: "Carbs", pct: carbsPct, kcal: carbsKcal, colorClass: MACRO_COLORS.carbs, dotClass: MACRO_COLORS.carbs.replace("text-", "bg-") },
            { label: "Fat", pct: fatPct, kcal: fatKcal, colorClass: MACRO_COLORS.fat, dotClass: MACRO_COLORS.fat.replace("text-", "bg-") },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div className={`size-2 rounded-full ${item.dotClass}`} />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <span className={`text-xs font-semibold ${item.colorClass}`}>
                {Math.round(item.pct)}%
              </span>
              <span className="text-[10px] text-muted-foreground">{Math.round(item.kcal)} kcal</span>
            </div>
          ))}
        </div>

        {/* Total from macros */}
        {macroKcalFromMacros > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">Calories from macros</p>
            <p className="text-lg font-bold text-foreground">{Math.round(macroKcalFromMacros)} kcal</p>
          </div>
        )}

        {/* Mismatch warning */}
        {hasMismatch && calorieDiff !== null && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <Info className="size-4 shrink-0 text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-300">
              Your macro targets add up to {Math.round(macroKcalFromMacros)} kcal,
              which is{" "}
              {calorieDiff > 0 ? `${Math.round(calorieDiff)} kcal below` : `${Math.round(Math.abs(calorieDiff))} kcal above`}{" "}
              your calorie goal of {calorieTarget} kcal. Consider adjusting your macros to match.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NutritionGoalsPage() {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<GoalValues>({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
  });

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("nutrition_goals")
        .select("*")
        .eq("user_id", user.id)
        .lte("effective_from", today)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch goals:", error);
        return;
      }

      if (data) {
        const goal = data as { calories_target: number | null; protein_g_target: number | null; carbs_g_target: number | null; fat_g_target: number | null; fiber_g_target: number | null };
        setValues({
          calories: goal.calories_target?.toString() ?? "",
          protein: goal.protein_g_target?.toString() ?? "",
          carbs: goal.carbs_g_target?.toString() ?? "",
          fat: goal.fat_g_target?.toString() ?? "",
          fiber: goal.fiber_g_target?.toString() ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  function handleChange(key: keyof GoalValues, val: string) {
    // Allow only positive numbers
    if (val !== "" && (isNaN(Number(val)) || Number(val) < 0)) return;
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be signed in to save goals.");
        return;
      }

      const calories = values.calories ? parseInt(values.calories, 10) : null;
      const protein = values.protein ? parseFloat(values.protein) : null;
      const carbs = values.carbs ? parseFloat(values.carbs) : null;
      const fat = values.fat ? parseFloat(values.fat) : null;
      const fiber = values.fiber ? parseFloat(values.fiber) : null;

      if (calories !== null && (isNaN(calories) || calories <= 0)) {
        toast.error("Please enter a valid calorie target.");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      // Check if there's already a goal for today (same effective_from date) to upsert
      const { data: existing } = await supabase
        .from("nutrition_goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("effective_from", today)
        .maybeSingle();

      if (existing) {
        const existingId = (existing as { id: string }).id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("nutrition_goals")
          .update({
            calories_target: calories,
            protein_g_target: protein,
            carbs_g_target: carbs,
            fat_g_target: fat,
            fiber_g_target: fiber,
          })
          .eq("id", existingId);

        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("nutrition_goals").insert({
          user_id: user.id,
          calories_target: calories,
          protein_g_target: protein,
          carbs_g_target: carbs,
          fat_g_target: fat,
          fiber_g_target: fiber,
          effective_from: today,
        });

        if (error) throw error;
      }

      toast.success("Nutrition goals saved!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save goals. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/nutrition">
            <Button size="icon" variant="ghost" className="size-9">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Nutrition Goals</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/nutrition">
          <Button size="icon" variant="ghost" className="size-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nutrition Goals</h1>
          <p className="text-xs text-muted-foreground">Set your daily targets</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Calories */}
        <Card>
          <CardContent className="pt-4 space-y-1.5">
            <Label htmlFor="calories" className="text-sm font-semibold text-foreground">
              Daily Calories
            </Label>
            <p className="text-xs text-muted-foreground">
              Your total energy target for the day
            </p>
            <div className="relative mt-2">
              <Input
                id="calories"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="e.g. 2200"
                value={values.calories}
                onChange={(e) => handleChange("calories", e.target.value)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                kcal
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Macros */}
        {macroInfo.map((macro) => (
          <Card key={macro.key}>
            <CardContent className="pt-4 space-y-1.5">
              <Label
                htmlFor={macro.key}
                className={`text-sm font-semibold ${macro.colorClass}`}
              >
                {macro.label}
              </Label>
              <p className="text-xs text-muted-foreground">{macro.description}</p>
              <div className="relative mt-2">
                <Input
                  id={macro.key}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={macro.placeholder}
                  value={values[macro.key]}
                  onChange={(e) => handleChange(macro.key, e.target.value)}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {macro.unit}
                </span>
              </div>
              {macro.kcalPerG != null && values[macro.key] && (
                <p className="text-[11px] text-muted-foreground">
                  ≈{" "}
                  {Math.round(parseFloat(values[macro.key] || "0") * macro.kcalPerG)}{" "}
                  kcal
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Macro breakdown visual */}
        <MacroBreakdown values={values} />

        {/* Tips card */}
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Goal Setting Tips</p>
                <p>
                  A common starting point: protein 0.8–1g per lb of body weight,
                  fat 20–35% of calories, rest from carbs.
                </p>
                <p>
                  Goals take effect today and remain active until you update them.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="w-full gap-2"
        >
          {saving ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save Goals
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
