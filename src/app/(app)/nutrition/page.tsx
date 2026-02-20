"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Settings2,
  Plus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Apple,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Share2,
} from "lucide-react";
import { addDays, subDays, format } from "date-fns";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { useSharedItems } from "@/hooks/use-shared-items";
import {
  trackNutritionCatchupCompleted,
  trackNutritionCatchupNudgeShown,
} from "@/lib/retention-events";
import { FoodLogCard } from "@/components/nutrition/food-log-card";
import { SendMealDialog } from "@/components/social/send-meal-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { MacroRing } from "@/components/ui/macro-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface FoodItem {
  id: string;
  name: string;
  brand: string | null;
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  serving_description: string | null;
  serving_size_g: number | null;
  source: string | null;
  barcode: string | null;
}

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: MealType;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

type EntryNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
};

const mealConfig: Record<MealType, { label: string; Icon: React.ElementType; color: string }> = {
  breakfast: {
    label: "Breakfast",
    Icon: Coffee,
    color: "text-amber-400",
  },
  lunch: {
    label: "Lunch",
    Icon: Sun,
    color: "text-yellow-400",
  },
  dinner: {
    label: "Dinner",
    Icon: Moon,
    color: "text-blue-400",
  },
  snack: {
    label: "Snacks",
    Icon: Cookie,
    color: "text-pink-400",
  },
};

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

function getEntryNutrition(entry: FoodLogEntry): EntryNutrition {
  const servings = entry.servings ?? 1;
  const item = entry.food_items;

  return {
    calories:
      item?.calories_per_serving != null
        ? roundTo2(item.calories_per_serving * servings)
        : entry.calories_consumed ?? 0,
    protein:
      item?.protein_g != null
        ? roundTo2(item.protein_g * servings)
        : entry.protein_g ?? 0,
    carbs:
      item?.carbs_g != null
        ? roundTo2(item.carbs_g * servings)
        : entry.carbs_g ?? 0,
    fat:
      item?.fat_g != null
        ? roundTo2(item.fat_g * servings)
        : entry.fat_g ?? 0,
    fiber:
      item?.fiber_g != null ? roundTo2(item.fiber_g * servings) : 0,
    sugar:
      item?.sugar_g != null ? roundTo2(item.sugar_g * servings) : 0,
    sodiumMg:
      item?.sodium_mg != null ? roundTo2(item.sodium_mg * servings) : 0,
  };
}

function MacroChip({
  label,
  value,
  goal,
  unit = "g",
  colorClass,
}: {
  label: string;
  value: number;
  goal?: number | null;
  unit?: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 sm:gap-1 sm:rounded-xl sm:px-3 sm:py-2">
      <span className={`text-[10px] font-semibold uppercase tracking-wider sm:text-xs ${colorClass}`}>{label}</span>
      <span className="text-sm font-bold text-foreground sm:text-base">
        {Math.round(value)}
        <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">{unit}</span>
      </span>
      {goal != null && goal > 0 ? (
        <span className="text-[9px] text-muted-foreground sm:text-[10px]">
          / {Math.round(goal)}
          {unit}
        </span>
      ) : null}
    </div>
  );
}

function MealSection({
  meal,
  entries,
  getNutrition,
  onDelete,
  onEdit,
}: {
  meal: MealType;
  entries: FoodLogEntry[];
  getNutrition: (entry: FoodLogEntry) => EntryNutrition;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}) {
  const { label, Icon, color } = mealConfig[meal];
  const mealCalories = entries.reduce((sum, e) => sum + getNutrition(e).calories, 0);

  return (
    <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Icon className={`size-4 ${color}`} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            {entries.length > 0 ? (
              <p className="text-xs text-muted-foreground">{Math.round(mealCalories)} kcal</p>
            ) : null}
          </div>
        </div>
        <Link href={`/nutrition/scan?meal=${meal}`}>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
            <Plus className="size-3.5" />
            Add
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nothing logged yet</p>
        ) : (
          entries.map((entry) => (
            <FoodLogCard key={entry.id} entry={entry} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

type GoalData = {
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  fiber_g_target?: number | null;
};

export default function NutritionPage() {
  const supabase = useSupabase();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [goals, setGoals] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sendMealDialogOpen, setSendMealDialogOpen] = useState(false);

  const { sendMealDay } = useSharedItems(currentUserId);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;
        setCurrentUserId(user.id);

        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const localDayStart = new Date(selectedDate);
        localDayStart.setHours(0, 0, 0, 0);
        const localNextDayStart = new Date(localDayStart);
        localNextDayStart.setDate(localNextDayStart.getDate() + 1);

        const { data: rawEntries } = await supabase
          .from("food_log")
          .select(
            "id, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g, logged_at, food_items(id, name, brand, barcode, source, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_description, serving_size_g)"
          )
          .eq("user_id", user.id)
          .gte("logged_at", localDayStart.toISOString())
          .lt("logged_at", localNextDayStart.toISOString())
          .order("logged_at", { ascending: true });

        setEntries((rawEntries ?? []) as unknown as FoodLogEntry[]);

        const { data: goalsData } = await supabase
          .from("nutrition_goals")
          .select("*")
          .eq("user_id", user.id)
          .lte("effective_from", dateStr)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle();

        setGoals((goalsData ?? null) as GoalData | null);
      } catch (err) {
        console.error("Failed to load nutrition data:", err);
        toast.error("Failed to load nutrition data");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [selectedDate, supabase]);

  async function handleDelete(entryId: string) {
    const previousEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    try {
      const { error } = await supabase.from("food_log").delete().eq("id", entryId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to delete entry");
    }
  }

  async function handleEdit(entryId: string, updates: { meal_type: string; servings: number }) {
    const previousEntries = entries;
    const current = previousEntries.find((entry) => entry.id === entryId) ?? null;
    if (!current) return;

    const nextNutrition = getEntryNutrition({ ...current, servings: updates.servings });

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              meal_type: updates.meal_type as MealType,
              servings: updates.servings,
              calories_consumed: nextNutrition.calories,
              protein_g: nextNutrition.protein,
              carbs_g: nextNutrition.carbs,
              fat_g: nextNutrition.fat,
            }
          : e
      )
    );

    try {
      const { error } = await supabase
        .from("food_log")
        .update({
          meal_type: updates.meal_type,
          servings: updates.servings,
          calories_consumed: nextNutrition.calories,
          protein_g: nextNutrition.protein,
          carbs_g: nextNutrition.carbs,
          fat_g: nextNutrition.fat,
        })
        .eq("id", entryId);

      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to update entry");
      throw err;
    }
  }

  const displayDate = format(selectedDate, "EEEE, MMMM d");

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const nutrition = getEntryNutrition(entry);
        acc.calories += nutrition.calories;
        acc.protein += nutrition.protein;
        acc.carbs += nutrition.carbs;
        acc.fat += nutrition.fat;
        acc.fiber += nutrition.fiber;
        acc.sugar += nutrition.sugar;
        acc.sodiumMg += nutrition.sodiumMg;
        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodiumMg: 0,
      }
    );
  }, [entries]);

  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const totalCarbs = totals.carbs;
  const totalFat = totals.fat;
  const totalFiber = totals.fiber;
  const totalSugar = totals.sugar;
  const totalSodiumMg = totals.sodiumMg;

  const mealGroups: Record<MealType, FoodLogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const entry of entries) {
    if (entry.meal_type in mealGroups) {
      mealGroups[entry.meal_type].push(entry);
    }
  }

  const calorieGoal = goals?.calories_target ?? null;
  const calorieProgress =
    calorieGoal != null && calorieGoal > 0
      ? Math.min((totalCalories / calorieGoal) * 100, 100)
      : null;
  const caloriesRemaining = calorieGoal != null ? calorieGoal - totalCalories : null;
  const isOver = caloriesRemaining != null && caloriesRemaining < 0;
  const proteinGoal = goals?.protein_g_target ?? null;
  const proteinRemaining = proteinGoal != null ? Math.max(0, proteinGoal - totalProtein) : null;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const hoursElapsed = Math.max(1, now.getHours() + now.getMinutes() / 60);
  const projectedProteinBy9pm =
    isToday && totalProtein > 0
      ? Math.round((totalProtein / hoursElapsed) * 21)
      : Math.round(totalProtein);
  const catchupNeeded = isToday && (proteinRemaining ?? 0) >= 20;

  useEffect(() => {
    if (!currentUserId || !catchupNeeded) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_nudge_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupNudgeShown(supabase, currentUserId, {
      date: dayKey,
      protein_remaining_g: Math.round(proteinRemaining ?? 0),
      protein_goal_g: proteinGoal,
      calories_so_far: Math.round(totalCalories),
    });
  }, [
    catchupNeeded,
    currentUserId,
    proteinRemaining,
    proteinGoal,
    selectedDate,
    supabase,
    totalCalories,
  ]);

  useEffect(() => {
    if (!currentUserId || !isToday || proteinGoal == null || proteinGoal <= 0) return;
    if (totalProtein < proteinGoal) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_completed:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupCompleted(supabase, currentUserId, {
      date: dayKey,
      protein_goal_g: proteinGoal,
      protein_logged_g: Math.round(totalProtein),
      calories_logged: Math.round(totalCalories),
    });
  }, [currentUserId, isToday, proteinGoal, selectedDate, supabase, totalCalories, totalProtein]);

  const mealEntryToSnapshot = (entry: FoodLogEntry) => {
    const nutrition = getEntryNutrition(entry);
    return {
      name: entry.food_items?.name ?? entry.food_name ?? "Unknown",
      brand: entry.food_items?.brand ?? entry.food_brand ?? null,
      servings: entry.servings,
      calories: nutrition.calories,
      protein_g: nutrition.protein,
      carbs_g: nutrition.carbs,
      fat_g: nutrition.fat,
    };
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-4 md:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-36 w-36 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative space-y-4">
          <PageHeader
            eyebrow={displayDate}
            title="Nutrition"
            actions={
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setSendMealDialogOpen(true)}
                  disabled={entries.length === 0}
                  title="Share today's meals"
                >
                  <Share2 className="size-4" />
                  <span className="sr-only">Share Day</span>
                </Button>
                <Link href="/nutrition/scan">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Barcode className="size-4" />
                    <span className="hidden sm:inline">Scan</span>
                  </Button>
                </Link>
                <Link href="/nutrition/goals">
                  <Button size="icon" variant="ghost" className="size-9">
                    <Settings2 className="size-4" />
                    <span className="sr-only">Nutrition Goals</span>
                  </Button>
                </Link>
              </>
            }
          />

          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-2 py-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="text-sm font-medium"
              >
                {format(selectedDate, "MMM d, yyyy") === format(new Date(), "MMM d, yyyy")
                  ? "Today"
                  : format(selectedDate, "MMM d, yyyy")}
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
              disabled={format(selectedDate, "yyyy-MM-dd") >= format(new Date(), "yyyy-MM-dd")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border-border/70 bg-card/85">
              <CardContent className="pt-5 pb-4">
                {isToday ? (
                  <div className="mb-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Fuel Readiness
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {proteinGoal
                        ? `Projected by 9PM: ${projectedProteinBy9pm}g protein`
                        : "Set a protein goal to activate predictive fueling guidance."}
                    </p>
                  </div>
                ) : null}

                {calorieGoal != null ? (
                  <>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Calories consumed</p>
                        <p className="text-2xl font-bold text-foreground sm:text-4xl">
                          {Math.round(totalCalories)}
                          <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">
                            / {calorieGoal} kcal
                          </span>
                        </p>
                      </div>
                      <Badge variant={isOver ? "destructive" : "secondary"} className="w-fit rounded-full px-2.5 text-xs">
                        {isOver
                          ? `${Math.abs(Math.round(caloriesRemaining!))} over`
                          : `${Math.round(caloriesRemaining!)} left`}
                      </Badge>
                    </div>
                    <Progress
                      value={calorieProgress ?? 0}
                      className={`h-3 ${isOver ? "[&>div]:bg-destructive" : ""}`}
                    />
                  </>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Calories consumed</p>
                      <p className="text-2xl font-bold text-foreground sm:text-4xl">
                        {Math.round(totalCalories)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">kcal</span>
                      </p>
                    </div>
                    <Link href="/nutrition/goals">
                      <Button size="sm" variant="outline" className="w-fit gap-1.5 text-xs">
                        <Apple className="size-3.5" />
                        Set Goals
                      </Button>
                    </Link>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MacroChip label="Protein" value={totalProtein} goal={goals?.protein_g_target} colorClass={MACRO_COLORS.protein} />
                  <MacroChip label="Carbs" value={totalCarbs} goal={goals?.carbs_g_target} colorClass={MACRO_COLORS.carbs} />
                  <MacroChip label="Fat" value={totalFat} goal={goals?.fat_g_target} colorClass={MACRO_COLORS.fat} />
                  <MacroChip label="Fiber" value={totalFiber} goal={goals?.fiber_g_target} colorClass={MACRO_COLORS.fiber} />
                  <MacroChip label="Sugar" value={totalSugar} colorClass="text-rose-400" />
                  <MacroChip label="Sodium" value={totalSodiumMg} unit="mg" colorClass="text-cyan-400" />
                </div>

                {catchupNeeded ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Protein Catch-Up</p>
                      <p className="text-sm font-medium text-foreground">
                        Need {Math.round(proteinRemaining ?? 0)}g more to hit today&apos;s target.
                      </p>
                    </div>
                    <Link href="/nutrition/scan">
                      <Button size="sm" className="motion-press h-8 rounded-lg px-3 text-xs">
                        Add Protein
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Macro Rings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="flex scale-[0.8] justify-center sm:scale-100"><MacroRing size={104} strokeWidth={10} macro="calories" value={totalCalories} target={goals?.calories_target ?? 0} label="Calories" /></div>
                <div className="flex scale-[0.8] justify-center sm:scale-100"><MacroRing size={104} strokeWidth={10} macro="protein" value={totalProtein} target={goals?.protein_g_target ?? 0} label="Protein" /></div>
                <div className="flex scale-[0.8] justify-center sm:scale-100"><MacroRing size={104} strokeWidth={10} macro="carbs" value={totalCarbs} target={goals?.carbs_g_target ?? 0} label="Carbs" /></div>
                <div className="flex scale-[0.8] justify-center sm:scale-100"><MacroRing size={104} strokeWidth={10} macro="fat" value={totalFat} target={goals?.fat_g_target ?? 0} label="Fat" /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Meals</h2>
          <p className="text-xs text-muted-foreground">Organized by meal windows</p>
        </div>

        {loading ? (
          <Card className="border-border/70 bg-card/85">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading nutrition data...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={mealGroups[meal]}
                getNutrition={getEntryNutrition}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>

      <SendMealDialog
        open={sendMealDialogOpen}
        currentUserId={currentUserId}
        snapshot={
          entries.length > 0
            ? {
                date: format(selectedDate, "yyyy-MM-dd"),
                totals: {
                  calories: totalCalories,
                  protein_g: totalProtein,
                  carbs_g: totalCarbs,
                  fat_g: totalFat,
                  fiber_g: totalFiber,
                  sugar_g: totalSugar,
                  sodium_mg: totalSodiumMg,
                },
                meals: {
                  breakfast: mealGroups.breakfast.map(mealEntryToSnapshot),
                  lunch: mealGroups.lunch.map(mealEntryToSnapshot),
                  dinner: mealGroups.dinner.map(mealEntryToSnapshot),
                  snack: mealGroups.snack.map(mealEntryToSnapshot),
                },
              }
            : null
        }
        onClose={() => setSendMealDialogOpen(false)}
        onSend={sendMealDay}
      />
    </div>
  );
}
