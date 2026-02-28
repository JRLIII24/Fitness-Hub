"use client";

import { memo } from "react";

interface ExerciseSparklineProps {
  weights: number[];
  slope: number;
}

export const ExerciseSparkline = memo(function ExerciseSparkline({
  weights,
  slope,
}: ExerciseSparklineProps) {
  if (weights.length < 2) return null;

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 48;
  const H = 20;

  const pts = weights
    .map(
      (w, i) =>
        `${(i / (weights.length - 1)) * W},${H - ((w - min) / range) * H}`
    )
    .join(" ");

  const color = slope > 0 ? "#22c55e" : slope < 0 ? "#ef4444" : "#6b7280";

  return (
    <svg
      width={W}
      height={H}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
