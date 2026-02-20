"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
}

export function StreakBadge({
  streak,
  size = "md",
  showIcon = true,
  showLabel = true,
  animate = true,
  className,
}: StreakBadgeProps) {
  if (streak === 0) return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-orange-500/10 font-medium text-orange-500",
        sizeClasses[size],
        animate && "transition-all duration-300 hover:bg-orange-500/20",
        className
      )}
    >
      {showIcon && (
        <Flame
          className={cn(
            iconSizes[size],
            animate && streak > 0 && "animate-pulse"
          )}
        />
      )}
      <span className="font-semibold tabular-nums">
        {streak}
      </span>
      {showLabel && (
        <span className="font-normal">
          {streak === 1 ? "day" : "days"}
        </span>
      )}
    </div>
  );
}
