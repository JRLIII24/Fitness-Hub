"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FoodScanResult, FoodEstimation } from "@/lib/food-scanner/types";

const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

interface ReviewItem extends FoodEstimation {
  included: boolean;
  multiplier: number;
}

interface FoodScanReviewProps {
  result: FoodScanResult;
  onConfirm: (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>) => void;
  onCancel: () => void;
}

export function FoodScanReview({ result, onConfirm, onCancel }: FoodScanReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    result.items.map((item) => ({ ...item, included: true, multiplier: 1 }))
  );

  const toggleItem = useCallback((idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item)));
  }, []);

  const setMultiplier = useCallback((idx: number, multiplier: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, multiplier } : item)));
  }, []);

  const selectedItems = useMemo(() => items.filter((i) => i.included), [items]);

  const totalCalories = useMemo(
    () => selectedItems.reduce((sum, i) => sum + Math.round(i.estimated_calories * i.multiplier), 0),
    [selectedItems]
  );

  const handleConfirm = useCallback(() => {
    const mapped = selectedItems.map((item) => ({
      food_name: item.food_name,
      calories: Math.round(item.estimated_calories * item.multiplier),
      protein_g: Math.round(item.estimated_protein_g * item.multiplier),
      carbs_g: Math.round(item.estimated_carbs_g * item.multiplier),
      fat_g: Math.round(item.estimated_fat_g * item.multiplier),
    }));
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
          const scaledCal = Math.round(item.estimated_calories * item.multiplier);
          const scaledP = Math.round(item.estimated_protein_g * item.multiplier);
          const scaledC = Math.round(item.estimated_carbs_g * item.multiplier);
          const scaledF = Math.round(item.estimated_fat_g * item.multiplier);
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
              {/* Top row: checkbox + name + confidence */}
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
                <Badge className={`shrink-0 text-[10px] font-bold ${confidenceColor(item.confidence)}`}>
                  {item.confidence}
                </Badge>
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
                        item.multiplier === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/60 border border-border/50 text-muted-foreground"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
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
              disabled={selectedItems.length === 0}
            >
              <Check className="size-4" />
              Log Selected
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
