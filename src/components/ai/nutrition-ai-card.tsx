"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lightbulb, Utensils, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_NUTRITION_ADVISOR_ENABLED } from "@/lib/features";
import type { AINutritionAdvice } from "@/app/api/ai/nutrition-advice/route";

const BALANCE_BADGE: Record<
  AINutritionAdvice["macro_balance"],
  { label: string; className: string }
> = {
  good:            { label: "Balanced",        className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
  low_protein:     { label: "Low Protein",     className: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  high_carb:       { label: "High Carb",       className: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  caloric_surplus: { label: "Caloric Surplus", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" },
  caloric_deficit: { label: "Caloric Deficit", className: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
};

export function NutritionAICard() {
  const [advice, setAdvice] = useState<AINutritionAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (!AI_NUTRITION_ADVISOR_ENABLED) {
      setLoading(false);
      return;
    }
    fetch("/api/ai/nutrition-advice")
      .then(async (r) => {
        if (r.status === 429) {
          setLimitReached(true);
          return null;
        }
        return r.json();
      })
      .then((data: AINutritionAdvice | null) => setAdvice(data ?? null))
      .catch(() => setAdvice(null))
      .finally(() => setLoading(false));
  }, []);

  if (!AI_NUTRITION_ADVISOR_ENABLED || (!loading && advice === null && !limitReached)) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  if (limitReached) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-border/60 bg-card/30 p-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Nutrition Advisor</span>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Daily limit reached. Check back tomorrow for fresh nutrition insights.
        </p>
      </motion.div>
    );
  }

  if (!advice) return null;

  const badge = BALANCE_BADGE[advice.macro_balance] ?? BALANCE_BADGE.good;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/15">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Nutrition Advisor</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-400/15">
            <Lightbulb className="h-3 w-3 text-amber-400" />
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{advice.top_tip}</p>
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15">
            <Utensils className="h-3 w-3 text-primary" />
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{advice.meal_suggestion}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-start gap-2 px-4 py-3 border-t border-border/40">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] italic text-muted-foreground">{advice.weekly_pattern}</p>
      </div>
    </motion.div>
  );
}
