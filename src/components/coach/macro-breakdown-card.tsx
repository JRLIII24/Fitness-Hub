"use client";

import { motion } from "framer-motion";
import { PieChart } from "lucide-react";

interface MacroRingProps {
  label: string;
  consumed: number;
  target: number;
  color: string;
  unit?: string;
}

function MacroRing({ label, consumed, target, color, unit = "g" }: MacroRingProps) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(target - consumed, 0);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const statusColor =
    pct >= 1 ? "text-amber-400" : pct >= 0.7 ? "text-emerald-400" : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted/20"
          />
          <motion.circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[11px] font-black tabular-nums ${statusColor}`}>
            {Math.round(remaining)}
          </span>
        </div>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[9px] tabular-nums text-muted-foreground/60">
        {Math.round(consumed)}/{target}{unit}
      </span>
    </div>
  );
}

interface MacroBreakdownData {
  target_calories?: number;
  consumed_calories?: number;
  target_protein?: number;
  consumed_protein?: number;
  target_carbs?: number;
  consumed_carbs?: number;
  target_fat?: number;
  consumed_fat?: number;
}

export function MacroBreakdownCard({ data }: { data?: Record<string, unknown> }) {
  const d = (data ?? {}) as unknown as MacroBreakdownData;

  const targetCal = d.target_calories ?? 2000;
  const consumedCal = d.consumed_calories ?? 0;
  const remainingCal = Math.max(targetCal - consumedCal, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-2.5 rounded-xl border border-border/60 bg-card/30 p-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Macro Breakdown
        </span>
      </div>

      {/* Calorie header */}
      <div className="text-center mb-3">
        <span className="text-[22px] font-black tabular-nums text-foreground">
          {Math.round(remainingCal)}
        </span>
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          cal remaining
        </span>
        <div className="mt-1 text-[10px] tabular-nums text-muted-foreground/60">
          {Math.round(consumedCal)} / {targetCal} kcal
        </div>
      </div>

      {/* Macro rings */}
      <div className="flex justify-around">
        <MacroRing
          label="Protein"
          consumed={d.consumed_protein ?? 0}
          target={d.target_protein ?? 150}
          color="#34d399"
        />
        <MacroRing
          label="Carbs"
          consumed={d.consumed_carbs ?? 0}
          target={d.target_carbs ?? 250}
          color="#38bdf8"
        />
        <MacroRing
          label="Fat"
          consumed={d.consumed_fat ?? 0}
          target={d.target_fat ?? 65}
          color="#a78bfa"
        />
      </div>
    </motion.div>
  );
}
