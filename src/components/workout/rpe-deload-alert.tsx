"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KG_TO_LBS } from "@/lib/units";

interface RpeDeloadAlertProps {
  /** Current weight in kg from the last completed set */
  lastWeightKg: number;
  /** Number of consecutive grinding sets (RIR ≤ 1) */
  consecutiveCount: number;
  /** User's unit preference */
  preference: "metric" | "imperial";
  /** Called with the suggested deloaded weight in kg */
  onApplyDeload: (newWeightKg: number) => void;
  /** Called when user dismisses the alert */
  onDismiss: () => void;
}

export function RpeDeloadAlert({
  lastWeightKg,
  consecutiveCount,
  preference,
  onApplyDeload,
  onDismiss,
}: RpeDeloadAlertProps) {
  const deloadedKg = Math.round(lastWeightKg * 0.9 * 100) / 100;
  const displayWeight =
    preference === "imperial"
      ? Math.round(deloadedKg * KG_TO_LBS * 10) / 10
      : deloadedKg;
  const unit = preference === "imperial" ? "lbs" : "kg";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          "rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3",
          "flex flex-col gap-2.5"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                High Effort Detected
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                Your last {consecutiveCount} sets were at RIR 0–1. Consider
                dropping weight to maintain quality reps.
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Action */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onApplyDeload(deloadedKg)}
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-lg",
            "border border-amber-500/20 bg-amber-500/10",
            "text-[12px] font-bold text-amber-400 transition-colors",
            "hover:bg-amber-500/15"
          )}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          Apply −10% → {displayWeight} {unit}
        </motion.button>
      </div>
    </motion.div>
  );
}
