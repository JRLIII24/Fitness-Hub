"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import { lengthToDisplay } from "@/lib/units";
import { cn } from "@/lib/utils";

type MeasurementRow = {
  measured_date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
};

const METRICS: {
  key: keyof Omit<MeasurementRow, "measured_date">;
  label: string;
  color: string;
}[] = [
  { key: "waist_cm", label: "Waist", color: "hsl(0, 80%, 60%)" },
  { key: "chest_cm", label: "Chest", color: "hsl(210, 80%, 60%)" },
  { key: "hips_cm", label: "Hips", color: "hsl(280, 70%, 60%)" },
  { key: "left_arm_cm", label: "L Arm", color: "hsl(45, 90%, 55%)" },
  { key: "right_arm_cm", label: "R Arm", color: "hsl(30, 85%, 55%)" },
  { key: "left_thigh_cm", label: "L Thigh", color: "hsl(150, 70%, 50%)" },
  { key: "right_thigh_cm", label: "R Thigh", color: "hsl(170, 70%, 50%)" },
];

function MeasurementsTooltip({
  active,
  payload,
  label,
  isImperial,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  isImperial: boolean;
}) {
  if (!active || !payload?.length) return null;
  const unit = isImperial ? "in" : "cm";
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      {payload.map((p) => {
        const metric = METRICS.find((m) => m.key === p.dataKey);
        const display = isImperial ? lengthToDisplay(p.value, true, 1) : p.value;
        return (
          <p key={p.dataKey} className="tabular-nums text-[12px] font-semibold" style={{ color: p.color }}>
            {metric?.label ?? p.dataKey}: {display} {unit}
          </p>
        );
      })}
    </div>
  );
}

export function MeasurementsChart({
  measurements,
  isImperial,
}: {
  measurements: MeasurementRow[];
  isImperial: boolean;
}) {
  // Determine which metrics have any data
  const availableMetrics = useMemo(() => {
    return METRICS.filter((m) =>
      measurements.some((row) => row[m.key] != null)
    );
  }, [measurements]);

  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => {
    // Default to showing waist if available, otherwise first available
    const defaultKey = availableMetrics.find((m) => m.key === "waist_cm")?.key ?? availableMetrics[0]?.key;
    return defaultKey ? new Set([defaultKey]) : new Set();
  });

  const toggleKey = (key: string) => {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const chartData = useMemo(() => {
    return [...measurements]
      .sort((a, b) => a.measured_date.localeCompare(b.measured_date))
      .map((row) => ({
        date: format(parseISO(row.measured_date), "MMM d"),
        ...Object.fromEntries(
          METRICS.map((m) => [m.key, row[m.key] ?? undefined])
        ),
      }));
  }, [measurements]);

  if (availableMetrics.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-muted-foreground">
        No measurement data to chart yet.
      </div>
    );
  }

  const unit = isImperial ? "in" : "cm";

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {availableMetrics.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleKey(m.key)}
            className={cn(
              "h-7 rounded-full px-2.5 text-[10px] font-semibold transition-colors",
              activeKeys.has(m.key)
                ? "text-white"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
            style={
              activeKeys.has(m.key)
                ? { backgroundColor: m.color }
                : undefined
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              `${isImperial ? lengthToDisplay(v, true, 1) : v}`
            }
            domain={["auto", "auto"]}
          />
          <Tooltip content={<MeasurementsTooltip isImperial={isImperial} />} />
          {METRICS.filter((m) => activeKeys.has(m.key)).map((m) => (
            <Line
              key={m.key}
              type="monotone"
              dataKey={m.key}
              stroke={m.color}
              strokeWidth={2}
              dot={chartData.length === 1 ? { r: 4, fill: m.color, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: m.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-[10px] text-muted-foreground">
        Values in {unit}
      </p>
    </div>
  );
}
