"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { EnrichedFoodScanResult, EnrichedFoodEstimation } from "@/lib/food-scanner/types";

const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

interface ReviewItem extends EnrichedFoodEstimation {
  included: boolean;
  multiplier: number;
  customGrams: number | null;
}

interface FoodScanReviewProps {
  result: EnrichedFoodScanResult;
  onConfirm: (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    source?: "ai-scan" | "usda";
  }>) => Promise<void> | void;
  onCancel: () => void;
  isLogging?: boolean;
}

function getEffectiveMultiplier(item: ReviewItem): number {
  if (item.customGrams !== null && item.estimated_weight_g > 0) {
    return item.customGrams / item.estimated_weight_g;
  }
  return item.multiplier;
}

export function FoodScanReview({ result, onConfirm, onCancel, isLogging = false }: FoodScanReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    result.items.map((item) => ({ ...item, included: true, multiplier: 1, customGrams: null }))
  );

  const toggleItem = useCallback((idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item)));
  }, []);

  const setMultiplier = useCallback((idx: number, multiplier: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, multiplier, customGrams: null } : item)));
  }, []);

  const setCustomGrams = useCallback((idx: number, grams: number | null) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, customGrams: grams, multiplier: grams !== null ? 0 : 1 } : item
      )
    );
  }, []);

  const selectedItems = useMemo(() => items.filter((i) => i.included), [items]);

  const totalCalories = useMemo(
    () => selectedItems.reduce((sum, i) => sum + Math.round(i.estimated_calories * getEffectiveMultiplier(i)), 0),
    [selectedItems]
  );

  const handleConfirm = useCallback(() => {
    const mapped = selectedItems.map((item) => {
      const mult = getEffectiveMultiplier(item);
      return {
        food_name: item.food_name,
        calories: Math.round(item.estimated_calories * mult),
        protein_g: Math.round(item.estimated_protein_g * mult),
        carbs_g: Math.round(item.estimated_carbs_g * mult),
        fat_g: Math.round(item.estimated_fat_g * mult),
        fiber_g: Math.round(item.estimated_fiber_g * mult),
        sugar_g: Math.round(item.estimated_sugar_g * mult),
        sodium_mg: Math.round(item.estimated_sodium_mg * mult),
        source: item.source,
      };
    });
    onConfirm(mapped);
  }, [selectedItems, onConfirm]);

  const confidenceColor = (c: "high" | "medium" | "low") => {
    switch (c) {
      case "high":
        return "bg-emerald-400/15 text-emerald-400";
      case "medium":
        return "bg-amber-400/15 text-amber-400";
      case "low":
        return "bg-red-400/15 text-red-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-black text-foreground">Review Detected Items</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Adjust portions and uncheck items you don&apos;t want to log.
        </p>
      </div>

      {/* Overall notes */}
      {result.overall_notes && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-[12px] text-muted-foreground">{result.overall_notes}</p>
        </div>
      )}

      {/* Item cards */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const mult = getEffectiveMultiplier(item);
          const scaledCal = Math.round(item.estimated_calories * mult);
          const scaledP = Math.round(item.estimated_protein_g * mult);
          const scaledC = Math.round(item.estimated_carbs_g * mult);
          const scaledF = Math.round(item.estimated_fat_g * mult);
          const scaledFi = Math.round(item.estimated_fiber_g * mult);
          const scaledSu = Math.round(item.estimated_sugar_g * mult);
          const scaledNa = Math.round(item.estimated_sodium_mg * mult);
          const isHighCal = scaledCal > 3000;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border border-border/50 p-4 space-y-3 transition-opacity ${
                item.included ? "bg-card/40" : "bg-card/20 opacity-50"
              }`}
            >
              {/* Top row: checkbox + name + badges */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(idx)}
                  className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.included
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/40 text-transparent"
                  }`}
                  style={{ minHeight: 44, minWidth: 44, padding: "11px" }}
                >
                  <Check className="size-3" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{item.food_name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.assumed_portion}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {item.source === "usda" && (
                    <Badge className="text-[10px] font-bold bg-emerald-400/15 text-emerald-400">
                      USDA
                    </Badge>
                  )}
                  <Badge className={`text-[10px] font-bold ${confidenceColor(item.confidence)}`}>
                    {item.confidence}
                  </Badge>
                </div>
              </div>

              {/* Portion multiplier */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Portion
                </label>
                <div className="flex gap-1.5">
                  {PORTION_MULTIPLIERS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(idx, m)}
                      className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                        item.customGrams === null && item.multiplier === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/60 border border-border/50 text-muted-foreground"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
                {/* Custom gram input */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    or
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={`${item.estimated_weight_g}g`}
                    value={item.customGrams ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomGrams(idx, val === "" ? null : Math.max(0, Number(val)));
                    }}
                    className="h-8 w-24 text-[12px] tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground">grams</span>
                </div>
              </div>

              {/* Macro badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                  {scaledCal} cal
                </span>
                <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                  {scaledP}g P
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                  {scaledC}g C
                </span>
                <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                  {scaledF}g F
                </span>
                {scaledFi > 0 && (
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
                    {scaledFi}g Fi
                  </span>
                )}
                {scaledSu > 0 && (
                  <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-orange-400">
                    {scaledSu}g Su
                  </span>
                )}
                {scaledNa > 0 && (
                  <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-400">
                    {scaledNa}mg Na
                  </span>
                )}
              </div>

              {/* High calorie warning */}
              {isHighCal && (
                <div className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-2.5 py-2">
                  <AlertTriangle className="size-3 shrink-0 text-yellow-400" />
                  <p className="text-[11px] font-medium text-yellow-400">
                    Over 3,000 cal for a single item — double-check the portion
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Summary + actions */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
          </p>
          <p className="tabular-nums text-[20px] font-black leading-none text-foreground">
            {totalCalories} <span className="text-[11px] font-semibold text-muted-foreground">cal</span>
          </p>
        </div>

        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={onCancel}>
              <X className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button
              className="w-full gap-2"
              onClick={handleConfirm}
              disabled={selectedItems.length === 0 || isLogging}
            >
              {isLogging ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {isLogging ? "Logging..." : "Log Selected"}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
