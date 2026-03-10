"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Lightbulb, Sparkles } from "lucide-react";

export interface WorkoutRecap {
  summary: string;
  highlights: string[];
  improvement_tip: string;
  volume_trend: "up" | "down" | "stable";
}

interface WorkoutRecapCardProps {
  recap: WorkoutRecap | null;
  loading: boolean;
}

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 18);
    return () => clearInterval(interval);
  }, [started, text]);

  return <>{displayed}</>;
}

const trendConfig = {
  up: { icon: TrendingUp, label: "Volume Up", className: "text-emerald-400" },
  down: { icon: TrendingDown, label: "Volume Down", className: "text-amber-400" },
  stable: { icon: Minus, label: "Stable", className: "text-muted-foreground" },
};

export function WorkoutRecapCard({ recap, loading }: WorkoutRecapCardProps) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="mt-4 rounded-xl border border-border/60 bg-card/30 p-4"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain className="h-4 w-4" />
          </motion.div>
          <span className="text-xs font-semibold uppercase tracking-wider">
            AI Recap
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" />
        </div>
      </motion.div>
    );
  }

  if (!recap) return null;

  const Trend = trendConfig[recap.volume_trend];
  const TrendIcon = Trend.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, type: "spring", stiffness: 260, damping: 24 }}
      className="mt-4 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 to-accent/5 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            AI Recap
          </span>
        </div>
        <div className={`flex items-center gap-1 ${Trend.className}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {Trend.label}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">
        <TypewriterText text={recap.summary} delay={200} />
      </p>

      {/* Highlights */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {recap.highlights.map((highlight, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.4 + i * 0.1 }}
            className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {highlight}
          </motion.span>
        ))}
      </div>

      {/* Improvement Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="mt-3 flex items-start gap-2 rounded-lg border border-border/50 bg-card/40 p-2.5"
      >
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {recap.improvement_tip}
        </p>
      </motion.div>
    </motion.div>
  );
}
