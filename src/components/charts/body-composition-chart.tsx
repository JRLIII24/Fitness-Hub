"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { weightToDisplay } from "@/lib/units";
import { cn } from "@/lib/utils";

interface WeightLog {
  id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
}

type TimeRange = "30D" | "90D" | "1Y";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "30D", label: "30D" },
  { value: "90D", label: "90D" },
  { value: "1Y", label: "1Y" },
];

function getDaysForRange(range: TimeRange): number {
  switch (range) {
    case "30D":
      return 30;
    case "90D":
      return 90;
    case "1Y":
      return 365;
  }
}

interface ChartPoint {
  date: string;
  rawDate: string;
  weight: number;
  bodyFat: number | null;
}

function CompositionTooltip({
  active,
  payload,
  isImperial,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  isImperial: boolean;
}) {
  if (!active || !payload?.length) return null;
  const weightEntry = payload.find((p) => p.dataKey === "weight");
  const bfEntry = payload.find((p) => p.dataKey === "bodyFat");
  const unit = isImperial ? "lbs" : "kg";

  return (
    <div className="glass-surface-elevated glass-highlight rounded-xl px-3.5 py-2.5 text-xs">
      {weightEntry && (
        <p className="font-bold text-foreground">
          {weightToDisplay(weightEntry.value, isImperial, 1)} {unit}
        </p>
      )}
      {bfEntry && bfEntry.value != null && (
        <p className="mt-0.5" style={{ color: "oklch(0.75 0.15 150)" }}>
          {bfEntry.value.toFixed(1)}% body fat
        </p>
      )}
    </div>
  );
}

export function BodyCompositionChart({
  data,
  isImperial,
}: {
  data: WeightLog[];
  isImperial: boolean;
}) {
  const [range, setRange] = useState<TimeRange>("90D");

  const chartData = useMemo<ChartPoint[]>(() => {
    const days = getDaysForRange(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    return data
      .filter((d) => d.logged_date >= cutoffStr)
      .sort((a, b) => a.logged_date.localeCompare(b.logged_date))
      .map((d) => {
        const dateObj = new Date(d.logged_date + "T00:00:00");
        return {
          date: dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          rawDate: d.logged_date,
          weight: d.weight_kg,
          bodyFat: d.body_fat_pct,
        };
      });
  }, [data, range]);

  const hasBodyFat = chartData.some((d) => d.bodyFat != null);
  const unit = isImperial ? "lbs" : "kg";

  if (chartData.length === 0) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <TimeRangeSelector range={range} onChange={setRange} />
        </div>
        <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
          No body weight data in this period. Log your weight to see trends.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <TimeRangeSelector range={range} onChange={setRange} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={chartData}
          margin={{ top: 6, right: hasBodyFat ? 40 : 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--primary)"
                stopOpacity={0.25}
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
            dataKey="date"
            tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="weight"
            tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              `${weightToDisplay(v, isImperial, 0)}`
            }
            domain={["auto", "auto"]}
            width={36}
          />
          {hasBodyFat && (
            <YAxis
              yAxisId="bf"
              orientation="right"
              tick={{
                fill: "oklch(0.75 0.15 150)",
                fontSize: 10,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={["auto", "auto"]}
              width={36}
            />
          )}
          <Tooltip
            content={<CompositionTooltip isImperial={isImperial} />}
            cursor={{
              stroke: "rgba(129,140,248,0.25)",
              strokeWidth: 1,
              strokeDasharray: "4 3",
            }}
          />
          <Area
            yAxisId="weight"
            type="monotone"
            dataKey="weight"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#weightAreaGrad)"
            dot={chartData.length <= 15 ? { r: 3, fill: "var(--primary)", strokeWidth: 0 } : false}
            activeDot={{
              r: 4.5,
              fill: "var(--primary)",
              stroke: "rgba(129,140,248,0.35)",
              strokeWidth: 4,
            }}
            isAnimationActive={false}
          />
          {hasBodyFat && (
            <Line
              yAxisId="bf"
              type="monotone"
              dataKey="bodyFat"
              stroke="oklch(0.75 0.15 150)"
              strokeWidth={2}
              dot={chartData.length <= 15 ? { r: 3, fill: "oklch(0.75 0.15 150)", strokeWidth: 0 } : false}
              activeDot={{
                r: 4,
                fill: "oklch(0.75 0.15 150)",
              }}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4"
            style={{ backgroundColor: "var(--primary)" }}
          />
          Weight ({unit})
        </span>
        {hasBodyFat && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-4"
              style={{ backgroundColor: "oklch(0.75 0.15 150)" }}
            />
            Body Fat %
          </span>
        )}
      </div>
    </div>
  );
}

function TimeRangeSelector({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/30 p-0.5">
      {TIME_RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors",
            range === r.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
