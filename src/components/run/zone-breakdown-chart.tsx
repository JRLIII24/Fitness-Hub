"use client";

import type { ZoneBreakdown, RunIntensityZone } from "@/types/run";
import { ZONE_LABELS, ZONE_COLORS } from "@/types/run";

interface ZoneBreakdownChartProps {
  breakdown: ZoneBreakdown;
}

const ZONE_ORDER: RunIntensityZone[] = [
  "zone5_anaerobic",
  "zone4_threshold",
  "zone3_tempo",
  "zone2_aerobic",
  "zone1_active_recovery",
];

function formatZoneTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ZoneBreakdownChart({ breakdown }: ZoneBreakdownChartProps) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      {ZONE_ORDER.map((zone) => {
        const seconds = breakdown[zone];
        const pct = total > 0 ? (seconds / total) * 100 : 0;
        if (seconds === 0) return null;

        return (
          <div key={zone} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-medium"
                style={{ color: ZONE_COLORS[zone] }}
              >
                {ZONE_LABELS[zone]}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatZoneTime(seconds)} ({Math.round(pct)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: ZONE_COLORS[zone],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
