"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trophy, Target, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_PROGRESS_INSIGHT_ENABLED } from "@/lib/features";
import type { AIProgressInsight } from "@/app/api/ai/progress-insight/route";

const TREND_BADGE: Record<
  AIProgressInsight["strength_trend"],
  { label: string; className: string }
> = {
  improving: { label: "Improving", className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
  plateau:   { label: "Plateau",   className: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  declining: { label: "Declining", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" },
};

export function ProgressInsightCard() {
  const [insight, setInsight] = useState<AIProgressInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (!AI_PROGRESS_INSIGHT_ENABLED) {
      setLoading(false);
      return;
    }
    fetch("/api/ai/progress-insight")
      .then(async (r) => {
        if (r.status === 429) {
          setLimitReached(true);
          return null;
        }
        return r.json();
      })
      .then((data: AIProgressInsight | null) => setInsight(data ?? null))
      .catch(() => setInsight(null))
      .finally(() => setLoading(false));
  }, []);

  if (!AI_PROGRESS_INSIGHT_ENABLED || (!loading && insight === null && !limitReached)) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
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
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Progress Insight</span>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Daily limit reached. Check back tomorrow for fresh progress insights.
        </p>
      </motion.div>
    );
  }

  if (!insight) return null;

  const badge = TREND_BADGE[insight.strength_trend] ?? TREND_BADGE.plateau;

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
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[13px] font-bold text-foreground">AI Progress Insight</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-400/15">
            <Trophy className="h-3 w-3 text-amber-400" />
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{insight.top_achievement}</p>
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15">
            <Target className="h-3 w-3 text-primary" />
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{insight.focus_suggestion}</p>
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-400/15">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{insight.volume_insight}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/40">
        <p className="text-[11px] italic text-muted-foreground">{insight.motivational_note}</p>
      </div>
    </motion.div>
  );
}
