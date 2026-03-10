"use client";

import { useState, useEffect, useCallback } from "react";
import { startOfISOWeek, addWeeks, subWeeks, addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MealPlanCalendar, type MealPlan, type MealPlanDayEntry, type MealType } from "@/components/nutrition/meal-plan-calendar";
import { MealPlanAddEntrySheet } from "@/components/nutrition/meal-plan-add-entry-sheet";

export default function MealPlanPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfISOWeek(new Date()));
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ dayOfWeek: number; mealType: MealType } | null>(null);

  const weekStr = format(weekStart, "yyyy-MM-dd");

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nutrition/meal-plan?week=${weekStr}`);
      if (!res.ok) throw new Error("Failed to load");
      const { plan: p } = await res.json();
      setPlan(p ?? null);
    } catch {
      toast.error("Failed to load meal plan");
    } finally {
      setLoading(false);
    }
  }, [weekStr]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);

  const createPlan = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/nutrition/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Week of ${format(weekStart, "MMM d")}`,
          week_start: weekStr,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const { plan: p } = await res.json();
      setPlan(p);
    } catch {
      toast.error("Failed to create meal plan");
    } finally {
      setCreating(false);
    }
  };

  const handleEntryAdded = (entry: MealPlanDayEntry) => {
    setPlan((prev) => prev ? { ...prev, days: [...prev.days, entry] } : prev);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!plan) return;
    const previousPlan = plan;
    // Optimistic update
    setPlan((prev) => prev ? { ...prev, days: prev.days.filter((d) => d.id !== entryId) } : prev);
    try {
      const res = await fetch(`/api/nutrition/meal-plan/${plan.id}/days`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId }),
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch {
      setPlan(previousPlan); // rollback
      toast.error("Failed to remove item");
    }
  };

  const handleAddEntry = (dayOfWeek: number, mealType: MealType) => {
    setAddTarget({ dayOfWeek, mealType });
    setAddSheetOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Meal Plan</h1>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/30 px-4 py-3">
        <button
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[13px] font-bold text-foreground">
            {format(weekStart, "MMM d")} &ndash; {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {format(weekStart, "yyyy-MM-dd") === format(startOfISOWeek(new Date()), "yyyy-MM-dd") ? "This Week" : "Week"}
          </p>
        </div>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/30" />
          ))}
        </div>
      ) : plan ? (
        <MealPlanCalendar
          plan={plan}
          weekStart={weekStart}
          onAddEntry={handleAddEntry}
          onDeleteEntry={handleDeleteEntry}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">No meal plan for this week</p>
            <p className="text-[11px] text-muted-foreground mt-1">Create one to start planning your meals</p>
          </div>
          <Button
            onClick={createPlan}
            disabled={creating}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Meal Plan
          </Button>
        </div>
      )}

      {/* Add Entry Sheet */}
      {plan && addTarget && (
        <MealPlanAddEntrySheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          planId={plan.id}
          dayOfWeek={addTarget.dayOfWeek}
          mealType={addTarget.mealType}
          dayLabel={format(addDays(weekStart, addTarget.dayOfWeek), "EEEE, MMM d")}
          onEntryAdded={handleEntryAdded}
        />
      )}
    </div>
  );
}
