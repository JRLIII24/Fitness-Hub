import React from "react";
import { cn } from "@/lib/utils";

interface CalorieRingProps {
  consumed: number;
  goal: number;
}

export const CalorieRing = React.memo(function CalorieRing({ consumed, goal }: CalorieRingProps) {
  const R = 46;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg
        width="116"
        height="116"
        viewBox="0 0 116 116"
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <filter id="calorie-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
        />
        {/* Glow layer */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="10"
          fill="none"
          stroke={isOver ? "var(--status-negative)" : "var(--status-positive)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#calorie-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        {/* Progress */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          stroke={isOver ? "var(--status-negative)" : "var(--status-positive)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-display tabular-nums text-[22px] font-black leading-none text-[#F0F4FF]">
          {Math.round(consumed)}
        </span>
        <span className="text-[9px] font-semibold text-muted-foreground">kcal</span>
        <span
          className={cn(
            "mt-0.5 tabular-nums text-[9px] font-bold",
            isOver ? "text-[var(--status-negative)]" : "text-[var(--status-positive)]"
          )}
        >
          {isOver ? "+" : ""}
          {Math.round(isOver ? consumed - goal : remaining)}{" "}
          {isOver ? "over" : "left"}
        </span>
      </div>
    </div>
  );
});
