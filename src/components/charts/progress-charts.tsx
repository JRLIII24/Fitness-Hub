"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ─── Chart theme constants ──────────────────────────────────────────────────

const GRID_STROKE = "rgba(255,255,255,0.05)";
const TICK_STYLE = { fill: "rgba(255,255,255,0.4)", fontSize: 10 };

// ─── Custom Tooltips ────────────────────────────────────────────────────────

function SingleTooltip({
  active,
  payload,
  unitLabel = "kg",
}: {
  active?: boolean;
  payload?: { payload: { date: string; topWeight: number; topWeightReps: number; topSetWeight: number; topSetReps: number; topSetScore: number } }[];
  unitLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-primary/25 bg-card px-3.5 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 text-[10px] text-muted-foreground">{d.date}</p>
      <p className="text-sm font-bold text-foreground">
        {d.topWeight} {unitLabel}
      </p>
      <p className="mt-0.5 text-primary">
        {d.topSetReps} reps × {d.topSetWeight} ={" "}
        <span className="font-bold">
          {Math.round(d.topSetScore).toLocaleString()}
        </span>{" "}
        pts
      </p>
    </div>
  );
}

function StackedVolumeTooltip({
  active,
  payload,
  label,
  unitLabel = "kg",
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
  unitLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="min-w-[150px] rounded-xl border border-border/60 bg-card px-3.5 py-2.5 text-xs shadow-xl">
      <p className="mb-2 text-[10px] text-muted-foreground">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.name} className="mb-0.5 flex items-center gap-1.5">
            <div
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: p.fill }}
            />
            <span className="flex-1 text-muted-foreground">{p.name}</span>
            <span className="font-semibold text-foreground">
              {(p.value / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      <div className="mt-1.5 flex justify-between border-t border-border/40 pt-1.5">
        <span className="text-muted-foreground">Total</span>
        <span className="font-bold text-foreground">
          {(total / 1000).toFixed(1)}k {unitLabel}
        </span>
      </div>
    </div>
  );
}

function MiniVolumeTooltip({
  active,
  payload,
  color,
  unitLabel = "kg",
}: {
  active?: boolean;
  payload?: { value: number }[];
  color: string;
  unitLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs shadow-xl">
      <span style={{ color }} className="font-bold">
        {(payload[0].value / 1000).toFixed(1)}k {unitLabel}
      </span>
    </div>
  );
}

// ─── Sparkline Chart (for SparklineCard) ────────────────────────────────────

export function SparklineChart({
  name,
  dataPoints,
}: {
  name: string;
  dataPoints: { date: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dataPoints} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
        <defs>
          <linearGradient id={`sg-${name.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={1.8}
          fill={`url(#sg-${name.replace(/\s/g, "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Strength Line Chart (Single Exercise) ──────────────────────────────────

export function StrengthLineChart({
  strengthData,
  unitLabel,
}: {
  strengthData: Array<{
    date: string;
    topSetScore: number;
    topSetWeight: number;
    topSetReps: number;
    topWeight: number;
    topWeightReps: number;
    displayValue: number;
    rawDate: string;
  }>;
  unitLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={strengthData} margin={{ top: 6, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          content={<SingleTooltip unitLabel={unitLabel} />}
          cursor={{ stroke: "rgba(129,140,248,0.25)", strokeWidth: 1, strokeDasharray: "4 3" }}
        />
        <Line
          type="monotone"
          dataKey="displayValue"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 3.5, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 5.5, fill: "var(--primary)", stroke: "rgba(129,140,248,0.35)", strokeWidth: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Stacked Volume Bar Chart ───────────────────────────────────────────────

export function StackedVolumeBarChart({
  categoryVolumeData,
  unitLabel,
  volumeCategoryOrder,
  volumeCategoryColors,
}: {
  categoryVolumeData: Array<Record<string, unknown>>;
  unitLabel: string;
  volumeCategoryOrder: readonly string[];
  volumeCategoryColors: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={categoryVolumeData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={30}
        />
        <Tooltip
          content={<StackedVolumeTooltip unitLabel={unitLabel} />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        {volumeCategoryOrder.map((cat, i) => (
          <Bar
            key={cat}
            dataKey={cat}
            name={cat}
            stackId="a"
            fill={volumeCategoryColors[cat]}
            radius={i === volumeCategoryOrder.length - 1 ? [4, 4, 0, 0] : undefined}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Category Mini Volume Bar Chart ─────────────────────────────────────────

export function CategoryMiniBarChart({
  categoryVolumeData,
  category,
  color,
  unitLabel,
}: {
  categoryVolumeData: Array<Record<string, unknown>>;
  category: string;
  color: string;
  unitLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={categoryVolumeData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 8 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={24}
        />
        <Tooltip
          content={<MiniVolumeTooltip color={color} unitLabel={unitLabel} />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey={category} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
