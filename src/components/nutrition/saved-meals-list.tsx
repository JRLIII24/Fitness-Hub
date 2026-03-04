"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import type { MealTemplate } from "@/types/nutrition";

export function SavedMealsList({
  templates,
  onUse,
  onDelete,
}: {
  templates: MealTemplate[];
  onUse: (template: MealTemplate) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!templates.length) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-[13px] font-semibold">No saved meals yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Save a meal from your daily log to reuse it quickly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t, idx) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{t.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.items.length} item{t.items.length !== 1 ? "s" : ""} &middot;{" "}
              {Math.round(
                t.items.reduce((sum, i) => sum + i.calories * i.servings, 0)
              )}{" "}
              kcal
            </p>
          </div>
          <button
            onClick={() => onUse(t)}
            className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Use
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deletingId === t.id}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            {deletingId === t.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </motion.div>
      ))}
    </div>
  );
}
