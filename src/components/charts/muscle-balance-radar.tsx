"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";

interface MuscleGroupVolume {
  muscle_group: string;
  total_volume_kg: number;
  set_count: number;
}

// Normalize muscle group names to canonical groups
const CANONICAL_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
] as const;

const GROUP_ALIASES: Record<string, string> = {
  chest: "chest",
  back: "back",
  lats: "back",
  shoulders: "shoulders",
  delts: "shoulders",
  arms: "arms",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  legs: "legs",
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  core: "core",
  abs: "core",
  abdominals: "core",
  obliques: "core",
};

function normalizeGroup(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return GROUP_ALIASES[lower] ?? "other";
}

interface RadarPoint {
  group: string;
  volume: number;
  fullMark: number;
}

function RadarTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RadarPoint; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="glass-surface-elevated glass-highlight rounded-xl px-3.5 py-2.5 text-xs">
      <p className="font-bold capitalize text-foreground">{point.group}</p>
      <p className="mt-0.5 text-muted-foreground">
        {(point.volume / 1000).toFixed(1)}k kg volume
      </p>
    </div>
  );
}

export function MuscleBalanceRadar({
  data,
}: {
  data: MuscleGroupVolume[];
}) {
  const { radarData, imbalances } = useMemo(() => {
    // Aggregate into canonical groups
    const grouped = new Map<string, number>();
    for (const g of CANONICAL_GROUPS) grouped.set(g, 0);

    for (const item of data) {
      const canonical = normalizeGroup(item.muscle_group);
      if (canonical === "other") continue;
      grouped.set(canonical, (grouped.get(canonical) ?? 0) + item.total_volume_kg);
    }

    const values = Array.from(grouped.values()).filter((v) => v > 0);
    const maxVolume = Math.max(...values, 1);
    const minVolume = Math.min(...values.filter((v) => v > 0), maxVolume);

    const radarData: RadarPoint[] = CANONICAL_GROUPS.map((g) => ({
      group: g.charAt(0).toUpperCase() + g.slice(1),
      volume: grouped.get(g) ?? 0,
      fullMark: maxVolume,
    }));

    // Detect imbalances (any group > 2x another non-zero group)
    const imbalances: string[] = [];
    if (minVolume > 0 && maxVolume / minVolume > 2) {
      const highGroups = Array.from(grouped.entries())
        .filter(([, v]) => v > 0 && v / minVolume > 2)
        .map(([g]) => g);
      const lowGroups = Array.from(grouped.entries())
        .filter(([, v]) => v > 0 && v === minVolume)
        .map(([g]) => g);
      if (highGroups.length && lowGroups.length) {
        imbalances.push(
          `${lowGroups.join(", ")} volume is low relative to ${highGroups.join(", ")}`
        );
      }
    }

    return { radarData, imbalances };
  }, [data]);

  const hasData = radarData.some((p) => p.volume > 0);

  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center text-[13px] text-muted-foreground">
        No workout data in the last 30 days. Train to see your muscle balance.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid
            stroke="oklch(0.98 0 0 / 0.08)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="group"
            tick={{
              fill: "oklch(0.70 0 0)",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <PolarRadiusAxis
            tick={false}
            axisLine={false}
            domain={[0, "auto"]}
          />
          <Tooltip content={<RadarTooltipContent />} />
          <Radar
            name="Volume"
            dataKey="volume"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.2}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
      {imbalances.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-500">
            Imbalance detected
          </p>
          {imbalances.map((msg, i) => (
            <p key={i} className="mt-0.5 text-[11px] capitalize text-amber-400/80">
              {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
