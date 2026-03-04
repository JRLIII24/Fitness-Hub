import React from "react";
import { cn } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  value: number;
  goal: number | null;
  textColorClass: string;
  barColorClass: string;
  trackHeight?: string;
}

export const MacroBar = React.memo(function MacroBar({
  label,
  value,
  goal,
  textColorClass,
  barColorClass,
  trackHeight = "h-1",
}: MacroBarProps) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums text-xs font-bold", textColorClass)}>
          {Math.round(value)}g
          {goal && (
            <span className="font-normal text-muted-foreground"> / {goal}g</span>
          )}
        </span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-[var(--glass-tint-medium)]", trackHeight)}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            barColorClass,
            pct > 80 && "shadow-[0_0_8px_currentColor/30]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});
