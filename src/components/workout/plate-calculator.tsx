"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { motionDurations, motionEasings } from "@/lib/motion";
import { kgToDisplayValue } from "@/lib/units";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlateCalculatorProps {
  weightKg: number;
}

interface PlateEntry {
  weight: number;
  count: number;
}

interface PlateBreakdown {
  barWeight: number;
  plates: PlateEntry[];
  remainder: number;
}

/* ------------------------------------------------------------------ */
/*  Plate denominations & colors                                       */
/* ------------------------------------------------------------------ */

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LBS_PLATES = [45, 35, 25, 10, 5, 2.5];

const KG_BAR = 20;
const LBS_BAR = 45;

/** Standard plate colors (inline styles per project convention) */
const PLATE_COLORS_KG: Record<number, string> = {
  25: "#dc2626",   // red
  20: "#2563eb",   // blue
  15: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
  1.25: "#d1d5db", // silver
};

const PLATE_COLORS_LBS: Record<number, string> = {
  45: "#dc2626",   // red
  35: "#2563eb",   // blue
  25: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
};

/** Map plate weight to a proportional height (px) for the visual */
const PLATE_HEIGHT_KG: Record<number, number> = {
  25: 80,
  20: 72,
  15: 64,
  10: 54,
  5: 44,
  2.5: 36,
  1.25: 30,
};

const PLATE_HEIGHT_LBS: Record<number, number> = {
  45: 80,
  35: 72,
  25: 64,
  10: 54,
  5: 44,
  2.5: 36,
};

/* ------------------------------------------------------------------ */
/*  Math: greedy plate calculator                                      */
/* ------------------------------------------------------------------ */

export function calculatePlates(
  totalWeight: number,
  unit: "metric" | "imperial",
): PlateBreakdown | null {
  const barWeight = unit === "imperial" ? LBS_BAR : KG_BAR;
  const denominations = unit === "imperial" ? LBS_PLATES : KG_PLATES;

  if (totalWeight <= 0) return null;

  let perSide = (totalWeight - barWeight) / 2;

  if (perSide < 0) {
    return { barWeight, plates: [], remainder: 0 };
  }

  const plates: PlateEntry[] = [];

  for (const denom of denominations) {
    if (perSide >= denom) {
      const count = Math.floor(perSide / denom);
      plates.push({ weight: denom, count });
      perSide -= count * denom;
    }
  }

  // Round remainder to avoid floating-point artifacts
  const remainder = Math.round(perSide * 1000) / 1000;

  return { barWeight, plates, remainder };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlateCalculator({ weightKg }: PlateCalculatorProps) {
  const preference = useUnitPreferenceStore((s) => s.preference);
  const unitLabel = useUnitPreferenceStore((s) => s.unitLabel);

  const displayWeight =
    preference === "imperial"
      ? kgToDisplayValue(weightKg, 1)
      : weightKg;

  if (weightKg <= 0) return null;

  const result = calculatePlates(displayWeight, preference);

  if (!result) return null;

  const colorMap = preference === "imperial" ? PLATE_COLORS_LBS : PLATE_COLORS_KG;
  const heightMap = preference === "imperial" ? PLATE_HEIGHT_LBS : PLATE_HEIGHT_KG;

  const isAtOrBelowBar = result.plates.length === 0 && result.remainder === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionDurations.panel,
        ease: motionEasings.primary as unknown as [number, number, number, number],
      }}
      className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
    >
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Plate Loading
      </p>

      {/* At-or-below-bar message */}
      {isAtOrBelowBar && (
        <p className="text-sm text-muted-foreground">
          Weight is at or below the barbell ({result.barWeight} {unitLabel}).
          Consider dumbbells or a lighter bar.
        </p>
      )}

      {/* Barbell visual + plate chips */}
      {!isAtOrBelowBar && (
        <>
          {/* CSS barbell visualization (one side) */}
          <div className="flex items-center gap-0.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Bar sleeve */}
            <div
              className="h-3 w-10 rounded-l-full"
              style={{ background: "#a1a1aa" }}
            />
            {/* Bar shaft */}
            <div
              className="h-2 w-6"
              style={{ background: "#a1a1aa" }}
            />

            {/* Plates (largest -> smallest, left to right) */}
            {result.plates.map((entry) =>
              Array.from({ length: entry.count }).map((_, i) => (
                <div
                  key={`${entry.weight}-${i}`}
                  className="rounded-sm border border-black/10 flex-shrink-0"
                  style={{
                    width: 14,
                    height: heightMap[entry.weight] ?? 40,
                    background: colorMap[entry.weight] ?? "#6b7280",
                  }}
                />
              )),
            )}

            {/* Bar center */}
            <div
              className="h-2 w-4"
              style={{ background: "#a1a1aa" }}
            />
            <div className="text-[10px] font-medium text-muted-foreground pl-2 whitespace-nowrap">
              per side
            </div>
          </div>

          {/* Chip badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Bar: {result.barWeight} {unitLabel}
            </span>
            {result.plates.map((entry) => (
              <span
                key={entry.weight}
                className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {entry.count}x {entry.weight}
                {unitLabel}
              </span>
            ))}
          </div>

          {/* Remainder warning */}
          {result.remainder > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {result.remainder} {unitLabel} per side cannot be loaded with
                standard plates.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
