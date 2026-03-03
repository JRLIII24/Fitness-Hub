"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BatteryCharging, Dumbbell, Activity, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_RECOVERY_ADVISOR_ENABLED } from "@/lib/features";
import type { AIRecoveryAdvice } from "@/app/api/ai/recovery/route";

const STATUS_BADGE: Record<
  AIRecoveryAdvice["recovery_status"],
  { label: string; className: string }
> = {
  fresh:       { label: "Fresh",       className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
  moderate:    { label: "Moderate",    className: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  fatigued:    { label: "Fatigued",    className: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  overtrained: { label: "Overtrained", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" },
};

const ACTION_CONFIG: Record<
  AIRecoveryAdvice["recommended_action"],
  { label: string; Icon: React.ElementType; className: string }
> = {
  train:           { label: "Train Today",      Icon: Dumbbell,  className: "bg-primary/15 text-primary border-primary/30" },
  active_recovery: { label: "Active Recovery",  Icon: Activity,  className: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  full_rest:       { label: "Full Rest Day",    Icon: Moon,      className: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
};

export function RecoveryAICard() {
  const [advice, setAdvice] = useState<AIRecoveryAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (!AI_RECOVERY_ADVISOR_ENABLED) {
      setLoading(false);
      return;
    }
    fetch("/api/ai/recovery")
      .then(async (r) => {
        if (r.status === 429) {
          setLimitReached(true);
          return null;
        }
        return r.json();
      })
      .then((data: AIRecoveryAdvice | null) => setAdvice(data ?? null))
      .catch(() => setAdvice(null))
      .finally(() => setLoading(false));
  }, []);

  if (!AI_RECOVERY_ADVISOR_ENABLED || (!loading && advice === null && !limitReached)) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
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
            <BatteryCharging className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Recovery</span>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Daily limit reached. Check back tomorrow for fresh recovery insights.
        </p>
      </motion.div>
    );
  }

  if (!advice) return null;

  const badge = STATUS_BADGE[advice.recovery_status] ?? STATUS_BADGE.moderate;
  const action = ACTION_CONFIG[advice.recommended_action] ?? ACTION_CONFIG.active_recovery;
  const ActionIcon = action.Icon;

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
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-card/70">
            <BatteryCharging className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Recovery</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Action banner */}
      <div className="px-3 py-2.5 border-b border-border/40">
        <motion.div
          whileTap={{ scale: 0.97 }}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${action.className}`}
        >
          <ActionIcon className="h-4 w-4 shrink-0" />
          <span className="text-[13px] font-bold">{action.label}</span>
        </motion.div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        <div className="px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Today</p>
          <p className="text-[12px] leading-relaxed text-foreground">{advice.recovery_tip}</p>
        </div>
        <div className="px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tomorrow</p>
          <p className="text-[12px] leading-relaxed text-foreground">{advice.tomorrow_suggestion}</p>
        </div>
      </div>
    </motion.div>
  );
}
