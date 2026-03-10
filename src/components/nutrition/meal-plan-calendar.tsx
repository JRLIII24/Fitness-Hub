"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Plus, X, ChevronLeft, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlanDayEntry {
  id: string;
  plan_id: string;
  day_of_week: number;
  meal_type: MealType;
  food_item_id: string | null;
  custom_name: string | null;
  servings: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sort_order: number;
  created_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  name: string;
  week_start: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  days: MealPlanDayEntry[];
}

const MEAL_SLOTS: { type: MealType; label: string; Icon: React.ElementType }[] = [
  { type: "breakfast", label: "Breakfast", Icon: Coffee },
  { type: "lunch", label: "Lunch", Icon: Sun },
  { type: "dinner", label: "Dinner", Icon: Moon },
  { type: "snack", label: "Snack", Icon: Cookie },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MealPlanCalendarProps {
  plan: MealPlan;
  weekStart: Date;
  onAddEntry: (dayOfWeek: number, mealType: MealType) => void;
  onDeleteEntry: (entryId: string) => void;
}

export function MealPlanCalendar({ plan, weekStart, onAddEntry, onDeleteEntry }: MealPlanCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Per-day macro totals
  const dayMacros = useMemo(() => {
    const map: Record<number, { cal: number; protein: number }> = {};
    for (let d = 0; d <= 6; d++) {
      map[d] = { cal: 0, protein: 0 };
    }
    for (const entry of plan.days) {
      map[entry.day_of_week].cal += entry.calories ?? 0;
      map[entry.day_of_week].protein += entry.protein_g ?? 0;
    }
    return map;
  }, [plan.days]);

  if (selectedDay !== null) {
    const dayEntries = plan.days.filter((e) => e.day_of_week === selectedDay);
    const dayDate = addDays(weekStart, selectedDay);

    return (
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDay(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Week
          </button>
          <span className="text-[13px] font-bold text-foreground">
            {format(dayDate, "EEEE, MMM d")}
          </span>
        </div>

        <div className="space-y-3">
          {MEAL_SLOTS.map(({ type, label, Icon }) => {
            const slotEntries = dayEntries.filter((e) => e.meal_type === type);
            return (
              <div key={type} className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                </div>

                <AnimatePresence initial={false}>
                  {slotEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between rounded-full border border-border/40 bg-muted/30 px-3 py-1"
                    >
                      <span className="text-[11px] truncate max-w-[200px]">
                        {entry.custom_name ?? "Food item"}
                        {entry.calories != null && (
                          <span className="ml-1 text-muted-foreground">&middot; {Math.round(entry.calories)} kcal</span>
                        )}
                      </span>
                      <button
                        onClick={() => onDeleteEntry(entry.id)}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <button
                  onClick={() => onAddEntry(selectedDay, type)}
                  className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Week grid view
  return (
    <div className="rounded-2xl border border-border/60 bg-card/30 p-3">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, d) => {
          const dayDate = addDays(weekStart, d);
          const macros = dayMacros[d];
          const isToday = format(dayDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn(
                "rounded-xl border p-2 text-left transition-colors",
                isToday
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/50 bg-card/40 hover:border-border hover:bg-card/60"
              )}
            >
              <p className={cn(
                "text-[11px] font-semibold",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {DAY_LABELS[d]}
              </p>
              <p className="text-[13px] font-bold text-foreground">{format(dayDate, "d")}</p>
              {macros.cal > 0 ? (
                <p className="mt-1 text-[10px] font-semibold text-primary/70">
                  {Math.round(macros.cal)} kcal
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-muted-foreground/50">&mdash;</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
