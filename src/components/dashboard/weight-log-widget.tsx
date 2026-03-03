"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Scale, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

type WeightLog = {
  logged_date: string;
  weight_kg: number;
};

export function WeightLogWidget() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [latest, setLatest] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchLatest = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=1");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLatest(data[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLatest();
    useUnitPreferenceStore.persist.rehydrate();
  }, [fetchLatest]);

  const displayWeight = (kg: number) =>
    isImperial
      ? `${Math.round(kg * 2.20462 * 10) / 10} lbs`
      : `${Math.round(kg * 10) / 10} kg`;

  const handleSave = async () => {
    const val = parseFloat(input);
    if (!input || isNaN(val) || val <= 0) return;
    setSaving(true);
    const weight_kg = isImperial ? val / 2.20462 : val;
    const today = format(new Date(), "yyyy-MM-dd");
    const res = await fetch("/api/body/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logged_date: today, weight_kg }),
    });
    if (res.ok) {
      const data: WeightLog = await res.json();
      setLatest(data);
      setInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-bold">Body Weight</span>
        </div>
        <Link
          href="/body"
          className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          History <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-end gap-3">
        {latest ? (
          <div className="flex-1">
            <p className="text-[26px] font-black leading-none tabular-nums">
              {displayWeight(latest.weight_kg)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Last logged {format(new Date(`${latest.logged_date}T12:00:00`), "MMM d")}
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">No weight logged yet</p>
          </div>
        )}

        {/* Quick log */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder={isImperial ? "165" : "75"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSave()}
            className="h-8 w-20 rounded-lg border border-border/50 bg-background/60 px-2.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving || !input}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[11px] font-bold">{unitLabel}</span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
