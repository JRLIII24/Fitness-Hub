"use client";

import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";

interface MealSuggestionData {
  meal_name?: string;
  description?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  meal_type?: string;
}

export function MealSuggestionCard({ data, onLogMeal }: { data?: Record<string, unknown>; onLogMeal?: (meal: MealSuggestionData) => void }) {
  if (!data) return null;
  const d = data as unknown as MealSuggestionData;
  if (!d.meal_name) return null;

  const macros = [
    { label: "Cal", value: d.calories ?? 0, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "P", value: d.protein_g ?? 0, unit: "g", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "C", value: d.carbs_g ?? 0, unit: "g", color: "text-sky-400", bg: "bg-sky-400/10" },
    { label: "F", value: d.fat_g ?? 0, unit: "g", color: "text-violet-400", bg: "bg-violet-400/10" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-2.5 rounded-xl border border-border/60 bg-card/30 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Meal Suggestion
        </span>
        {d.meal_type && (
          <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {d.meal_type}
          </span>
        )}
      </div>

      <p className="text-[13px] font-bold text-foreground">{d.meal_name}</p>
      {d.description && (
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
          {d.description}
        </p>
      )}

      <div className="mt-2.5 flex gap-1.5">
        {macros.map((m) => (
          <span
            key={m.label}
            className={`flex-1 rounded-lg ${m.bg} px-2 py-1.5 text-center`}
          >
            <span className={`block text-[11px] font-black tabular-nums ${m.color}`}>
              {m.value}{m.unit ?? ""}
            </span>
            <span className="block text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
              {m.label}
            </span>
          </span>
        ))}
      </div>

      {onLogMeal && (
        <button
          type="button"
          onClick={() => onLogMeal(d)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 active:scale-[0.97]"
          style={{ minHeight: "44px" }}
        >
          Log This Meal
        </button>
      )}
    </motion.div>
  );
}
