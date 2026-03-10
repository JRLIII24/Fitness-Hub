"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
} from "recharts";
import { kgToLbs } from "@/lib/units";

interface WeeklyVolume {
  week_start: string;
  total_volume_kg: number;
}

interface ChartPoint {
  label: string;
  volume: number;
  movingAvg: number | null;
}

function formatVolume(kg: number, isImperial: boolean): string {
  const val = isImperial ? kgToLbs(kg) : kg;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return Math.round(val).toLocaleString();
}

function VolumeTooltip({
  active,
  payload,
  isImperial,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  isImperial: boolean;
}) {
  if (!active || !payload?.length) return null;
  const unit = isImperial ? "lbs" : "kg";
  const volumeEntry = payload.find((p) => p.dataKey === "volume");
  const avgEntry = payload.find((p) => p.dataKey === "movingAvg");

  return (
    <div className="glass-surface-elevated glass-highlight rounded-xl px-3.5 py-2.5 text-xs">
      {volumeEntry && (
        <p className="font-bold text-foreground">
          {formatVolume(volumeEntry.value, isImperial)} {unit}
        </p>
      )}
      {avgEntry && avgEntry.value != null && (
        <p className="mt-0.5 text-muted-foreground">
          Avg: {formatVolume(avgEntry.value, isImperial)} {unit}
        </p>
      )}
    </div>
  );
}

export function VolumePeriodizationChart({
  data,
  isImperial,
}: {
  data: WeeklyVolume[];
  isImperial: boolean;
}) {
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!data.length) return [];

    // Compute 3-week moving average
    return data.map((point, idx) => {
      const date = new Date(point.week_start);
      const label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      let movingAvg: number | null = null;
      if (idx >= 2) {
        const window = data.slice(idx - 2, idx + 1);
        movingAvg =
          window.reduce((sum, w) => sum + w.total_volume_kg, 0) / window.length;
      }

      return {
        label,
        volume: isImperial
          ? Math.round(kgToLbs(point.total_volume_kg))
          : point.total_volume_kg,
        movingAvg:
          movingAvg != null
            ? isImperial
              ? Math.round(kgToLbs(movingAvg))
              : Math.round(movingAvg)
            : null,
      };
    });
  }, [data, isImperial]);

  const unit = isImperial ? "lbs" : "kg";

  if (chartData.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
        No volume data yet. Complete workouts to see your periodization trend.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={chartData}
          margin={{ top: 6, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--primary)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--primary)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(0.98 0 0 / 0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={36}
          />
          <Tooltip
            content={<VolumeTooltip isImperial={isImperial} />}
            cursor={{
              stroke: "rgba(129,140,248,0.25)",
              strokeWidth: 1,
              strokeDasharray: "4 3",
            }}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#volGrad)"
            dot={false}
            activeDot={{
              r: 4.5,
              fill: "var(--primary)",
              stroke: "rgba(129,140,248,0.35)",
              strokeWidth: 4,
            }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="movingAvg"
            stroke="oklch(0.75 0.15 60)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4"
            style={{ backgroundColor: "var(--primary)" }}
          />
          Weekly Volume ({unit})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4"
            style={{
              backgroundColor: "oklch(0.75 0.15 60)",
              backgroundImage:
                "repeating-linear-gradient(90deg, oklch(0.75 0.15 60) 0 6px, transparent 6px 9px)",
              backgroundClip: "padding-box",
            }}
          />
          3-Week Moving Avg
        </span>
      </div>
    </div>
  );
}
