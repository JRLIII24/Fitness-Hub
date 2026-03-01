"use client";

import { Zap } from "lucide-react";

interface XpProgressBarProps {
  level: number;
  xp: number;
}

/**
 * Compact XP progress bar showing current level, XP, and progress to next level.
 * Level curve: next level requires current_level × 100 XP (matches migration 022 formula).
 */
export function XpProgressBar({ level, xp }: XpProgressBarProps) {
  const xpToNextLevel = level * 100;
  const progressPercent = Math.min(100, Math.round((xp / xpToNextLevel) * 100));

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
      <Zap className="h-2.5 w-2.5 shrink-0 text-primary" />
      <span className="text-[10px] font-bold text-primary">Lv.{level}</span>
      {/* Progress bar track */}
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-primary/20">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span className="text-[10px] font-normal text-muted-foreground">
        {xp}/{xpToNextLevel}
      </span>
    </div>
  );
}
