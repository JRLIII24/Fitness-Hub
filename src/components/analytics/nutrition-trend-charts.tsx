"use client";

import { useEffect, useState } from "react";
import { parseISO, format } from "date-fns";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  NutritionTrendsResponse,
  NutritionTrendDay,
} from "@/app/api/nutrition/trends/route";

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 7 | 30 | 90;

interface ChartPoint {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDay(day: string): string {
  try {
    return format(parseISO(day), "MMM d");
  } catch {
    return day;
  }
}

function toChartPoints(days: NutritionTrendDay[]): ChartPoint[] {
  return days.map((d) => ({
    date: formatDay(d.day),
    calories: d.calories,
    protein_g: d.protein_g,
    carbs_g: d.carbs_g,
    fat_g: d.fat_g,
  }));
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CalorieTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-surface-elevated glass-highlight rounded-xl px-3.5 py-2.5 text-xs">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-bold text-foreground">{Math.round(payload[0].value)} kcal</p>
    </div>
  );
}

function MacroTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const protein = payload.find((p) => p.dataKey === "protein_g");
  const carbs = payload.find((p) => p.dataKey === "carbs_g");
  const fat = payload.find((p) => p.dataKey === "fat_g");
  return (
    <div className="glass-surface-elevated glass-highlight rounded-xl px-3.5 py-2.5 text-xs">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {protein && (
        <p style={{ color: "var(--primary)" }}>
          <span className="font-bold">{Math.round(protein.value)}g</span> protein
        </p>
      )}
      {carbs && (
        <p style={{ color: "oklch(0.82 0.18 85)" }}>
          <span className="font-bold">{Math.round(carbs.value)}g</span> carbs
        </p>
      )}
      {fat && (
        <p style={{ color: "oklch(0.72 0.18 25)" }}>
          <span className="font-bold">{Math.round(fat.value)}g</span> fat
        </p>
      )}
    </div>
  );
}

// ── Period selector (same pattern as body-composition-chart.tsx) ───────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/30 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors",
            period === p.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NutritionTrendCharts() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<NutritionTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/nutrition/trends?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  const chartPoints = data ? toChartPoints(data.days) : [];
  const goals = data?.goals ?? null;
  const hasData = chartPoints.length > 0;

  // Determine tick interval so labels don't crowd
  const tickInterval = chartPoints.length > 20 ? Math.floor(chartPoints.length / 8) : "preserveStartEnd";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Utensils className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-bold">Nutrition Trends</span>
        <div className="ml-auto">
          <PeriodSelector period={period} onChange={setPeriod} />
        </div>
      </div>
      <div className="h-px bg-border/40" />

      <div className="space-y-6 p-5">
        {/* Calorie Trend */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Daily Calories
          </p>
          {loading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/20" />
          ) : !hasData ? (
            <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
              No nutrition logs in this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartPoints} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
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
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                  domain={["auto", "auto"]}
                  width={36}
                />
                <Tooltip
                  content={<CalorieTooltip />}
                  cursor={{ stroke: "rgba(129,140,248,0.25)", strokeWidth: 1, strokeDasharray: "4 3" }}
                />
                {goals?.calories_target != null && (
                  <ReferenceLine
                    y={goals.calories_target}
                    stroke="oklch(0.70 0 0)"
                    strokeDasharray="5 4"
                    strokeWidth={1}
                    label={{
                      value: "Goal",
                      fill: "oklch(0.70 0 0)",
                      fontSize: 9,
                      position: "right",
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="calories"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#calGrad)"
                  dot={chartPoints.length <= 15 ? { r: 3, fill: "var(--primary)", strokeWidth: 0 } : false}
                  activeDot={{ r: 4.5, fill: "var(--primary)", stroke: "rgba(129,140,248,0.35)", strokeWidth: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="h-px bg-border/40" />

        {/* Macro Breakdown */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Macro Breakdown (g)
          </p>
          {loading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/20" />
          ) : !hasData ? (
            <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
              No nutrition logs in this period.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartPoints} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
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
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.70 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    content={<MacroTooltip />}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar
                    dataKey="protein_g"
                    stackId="macros"
                    fill="var(--primary)"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="carbs_g"
                    stackId="macros"
                    fill="oklch(0.82 0.18 85)"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="fat_g"
                    stackId="macros"
                    fill="oklch(0.72 0.18 25)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--primary)" }} />
                  Protein
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "oklch(0.82 0.18 85)" }} />
                  Carbs
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "oklch(0.72 0.18 25)" }} />
                  Fat
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
