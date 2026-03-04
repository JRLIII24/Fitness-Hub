import React from "react";
import { cn } from "@/lib/utils";

interface ProteinRingProps {
  consumed: number;
  goal: number;
}

export const ProteinRing = React.memo(function ProteinRing({ consumed, goal }: ProteinRingProps) {
  const R = 30;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <filter id="protein-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="38" cy="38" r={R} strokeWidth="5" fill="none" className="stroke-border" />
        {/* Glow layer */}
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#protein-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="5"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="tabular-nums text-[16px] font-black leading-none text-blue-400">
          {Math.round(consumed)}
        </span>
        <span className="text-[8px] font-semibold text-muted-foreground">
          {isOver ? "over" : "left"}
        </span>
        <span className={cn("tabular-nums text-[8px] font-bold", isOver ? "text-rose-400" : "text-blue-400")}>
          {Math.round(isOver ? consumed - goal : remaining)}g
        </span>
      </div>
    </div>
  );
});
