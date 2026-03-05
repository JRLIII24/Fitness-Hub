"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Utensils, Lightbulb } from "lucide-react";
import type { MenuScanResult, MenuRecommendation } from "@/lib/menu-scanner/types";

interface MenuRecommendationSheetProps {
  results: MenuScanResult | null;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
  open: boolean;
}

export function MenuRecommendationSheet({ results, remaining, onClose, onLog, open }: MenuRecommendationSheetProps) {
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && results && (
        <SheetContent results={results} remaining={remaining} onClose={onClose} onLog={onLog} />
      )}
    </AnimatePresence>,
    portalTarget
  );
}

function SheetContent({
  results,
  remaining,
  onClose,
  onLog,
}: {
  results: MenuScanResult;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}) {
  const macroPills = [
    { label: "Cal", value: remaining.calories, color: "bg-foreground/10 text-foreground" },
    { label: "P", value: `${remaining.protein_g}g`, color: "bg-blue-400/15 text-blue-400" },
    { label: "C", value: `${remaining.carbs_g}g`, color: "bg-amber-400/15 text-amber-400" },
    { label: "F", value: `${remaining.fat_g}g`, color: "bg-pink-400/15 text-pink-400" },
  ];

  function handleLog(rec: MenuRecommendation) {
    onLog({
      name: rec.name,
      calories: rec.estimated_calories,
      protein_g: rec.estimated_protein_g,
      carbs_g: rec.estimated_carbs_g,
      fat_g: rec.estimated_fat_g,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden glass-surface-modal glass-highlight rounded-t-3xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-0 pt-3">
          <div className="h-1 w-9 rounded-full bg-border/50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-[15px] font-black text-foreground">Menu Picks For You</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Remaining macros bar */}
        <div className="flex gap-2 px-5 pb-4">
          {macroPills.map((p) => (
            <div
              key={p.label}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.color}`}
            >
              <span className="opacity-60">{p.label}</span>
              <span className="tabular-nums">{p.value}</span>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-3">
            {results.top_3_recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
              >
                {/* Name + reason */}
                <div>
                  <div className="flex items-start gap-2">
                    <Utensils className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <h3 className="text-[13px] font-bold text-foreground">{rec.name}</h3>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{rec.reason}</p>
                </div>

                {/* Macro badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                    {rec.estimated_calories} cal
                  </span>
                  <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                    {rec.estimated_protein_g}g P
                  </span>
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                    {rec.estimated_carbs_g}g C
                  </span>
                  <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                    {rec.estimated_fat_g}g F
                  </span>
                </div>

                {/* Modification tip */}
                {rec.modification_tip && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2">
                    <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400" />
                    <p className="text-[11px] text-amber-400">{rec.modification_tip}</p>
                  </div>
                )}

                {/* Log button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLog(rec)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground"
                >
                  Log This
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* Overall tip */}
          {results.overall_tip && (
            <div className="mt-4 rounded-xl border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Overall Tip</p>
              <p className="text-[12px] text-muted-foreground">{results.overall_tip}</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
