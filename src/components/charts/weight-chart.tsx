"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { weightToDisplay } from "@/lib/units";

function kgToDisplay(kg: number, isImperial: boolean) {
  return weightToDisplay(kg, isImperial, 1);
}

function WeightTooltip({ active, payload, label, isImperial }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  isImperial: boolean;
}) {
  if (!active || !payload?.length) return null;
  const kg = payload[0].value;
  const display = kgToDisplay(kg, isImperial);
  const unit = isImperial ? "lbs" : "kg";
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm text-sm">
      <p className="font-semibold tabular-nums">{display} {unit}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function WeightChart({
  chartData,
  isImperial,
}: {
  chartData: Array<{ date: string; weight_kg: number }>;
  isImperial: boolean;
}) {
  const hasSinglePoint = chartData.length === 1;
  const primaryColor = "var(--primary)";
  const borderColor = "var(--border)";
  const mutedColor = "var(--muted-foreground)";

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.36} />
            <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={borderColor} opacity={0.4} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: mutedColor }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: mutedColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => kgToDisplay(v, isImperial).toString()}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<WeightTooltip isImperial={isImperial} />} />
        <Area
          type="monotone"
          dataKey="weight_kg"
          stroke={primaryColor}
          strokeWidth={2}
          fill="url(#weightGrad)"
          dot={hasSinglePoint ? { r: 4, fill: primaryColor, strokeWidth: 0 } : false}
          activeDot={{ r: 4, fill: primaryColor }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
