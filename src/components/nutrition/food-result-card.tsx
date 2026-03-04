"use client";

import { MACRO_COLORS } from "@/lib/constants";
import type { FoodItem } from "@/types/nutrition";

export function FoodResultCard({ food }: { food: FoodItem }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground leading-snug">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {food.serving_description ?? (food.serving_size_g ? `${food.serving_size_g}g` : "1 serving")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{Math.round(food.calories_per_serving)}</p>
          <p className="text-xs text-muted-foreground">kcal</p>
        </div>
      </div>
      {(food.protein_g != null ||
        food.carbs_g != null ||
        food.fat_g != null ||
        food.fiber_g != null ||
        food.sugar_g != null ||
        food.sodium_mg != null) && (
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          {food.protein_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(food.protein_g)}g
            </span>
          )}
          {food.carbs_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(food.carbs_g)}g
            </span>
          )}
          {food.fat_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(food.fat_g)}g
            </span>
          )}
          {food.fiber_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(food.fiber_g)}g
            </span>
          )}
          {food.sugar_g != null && (
            <span>
              <span className="font-medium text-rose-400">Su</span> {Math.round(food.sugar_g)}g
            </span>
          )}
          {food.sodium_mg != null && (
            <span>
              <span className="font-medium text-cyan-400">Na</span> {Math.round(food.sodium_mg)}mg
            </span>
          )}
        </div>
      )}
    </div>
  );
}
