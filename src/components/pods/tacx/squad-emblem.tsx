"use client";

import { useMemo } from "react";
import { tierCfg, tierLabel } from "@/lib/pods/y2k-tokens";
import type { ArenaTier } from "@/types/pods";

interface CrewEmblemProps {
  podId: string;
  tier: ArenaTier;
  memberCount: number;
  size?: number;
}

/**
 * Deterministic SVG emblem generated from pod.id (seed) + arena_level.
 * Uses rounded shapes (circles, rounded polygons) for the Y2K aesthetic.
 * No backend needed — identical render on every device.
 */
export function CrewEmblem({
  podId,
  tier,
  memberCount,
  size = 48,
}: CrewEmblemProps) {
  const tc = tierCfg(tier);

  // Deterministic seed from pod ID
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < podId.length; i++) {
      h = (Math.imul(31, h) + podId.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }, [podId]);

  // Pattern variation from seed
  const patternRotation = (seed % 6) * 60;
  const innerScale = 0.4 + (seed % 4) * 0.08;

  const half = size / 2;
  const r = half * 0.85;

  // Inner orbital dots
  const innerDots = useMemo(() => {
    const count = 3 + (seed % 4);
    const ir = r * innerScale;
    const dots = [];
    for (let i = 0; i < count; i++) {
      const angle =
        ((i * (360 / count) + patternRotation) * Math.PI) / 180;
      dots.push({
        cx: half + ir * Math.cos(angle),
        cy: half + ir * Math.sin(angle),
        r: 2 + (seed % 2),
      });
    }
    return dots;
  }, [seed, r, innerScale, patternRotation, half]);

  const label = tierLabel(tier);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
    >
      {/* Outer glow */}
      <defs>
        <filter id={`glow-${podId.slice(0, 8)}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer circle */}
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke={tc.fg}
        strokeWidth="1.5"
        opacity="0.85"
        filter={`url(#glow-${podId.slice(0, 8)})`}
      />

      {/* Fill circle */}
      <circle
        cx={half}
        cy={half}
        r={r}
        fill={tc.fg}
        opacity="0.15"
      />

      {/* Inner ring */}
      <circle
        cx={half}
        cy={half}
        r={r * innerScale}
        fill="none"
        stroke={tc.fg}
        strokeWidth="1"
        opacity="0.45"
      />

      {/* Orbital dots */}
      {innerDots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill={tc.fg}
          opacity="0.75"
        />
      ))}

      {/* Center tier label */}
      <text
        x={half}
        y={half + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={tc.fg}
        fontSize={size * 0.18}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="900"
        opacity="0.9"
      >
        {label.slice(0, 3).toUpperCase()}
      </text>
    </svg>
  );
}

/** @deprecated Use CrewEmblem instead */
export const SquadEmblem = CrewEmblem;
