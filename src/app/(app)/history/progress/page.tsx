"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  TrendingUp,
  BarChart3,
  Trophy,
  ArrowLeft,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type RawSet = {
  session_id: string;
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  set_type: string;
  workout_sessions: {
    started_at: string;
    status: string;
  };
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type RawSession = {
  id: string;
  name: string;
  started_at: string;
  total_volume_kg: number | null;
};

// ─── Volume category mapping ──────────────────────────────────────────────────

const VOLUME_CATEGORIES: Record<string, string> = {
  chest: "Upper Body",
  back: "Upper Body",
  shoulders: "Upper Body",
  arms: "Upper Body",
  legs: "Legs",
  core: "Core",
  full_body: "Full Body",
};

const VOLUME_CATEGORY_COLORS: Record<string, string> = {
  "Upper Body": "var(--color-primary)",
  Legs: "#f87171",
  Core: "#facc15",
  "Full Body": "#34d399",
};

const VOLUME_CATEGORY_ORDER = ["Upper Body", "Legs", "Core", "Full Body"] as const;

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (t: string) => void;
}) {
  const tabs = [
    { id: "strength", label: "Strength", icon: TrendingUp },
    { id: "volume", label: "Volume", icon: BarChart3 },
    { id: "records", label: "Records", icon: Trophy },
  ];
  return (
    <div className="flex gap-0.5 rounded-2xl border border-border/60 bg-muted/40 p-1 backdrop-blur-sm">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function PillToggle({
  opts,
  active,
  onChange,
}: {
  opts: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-full border border-border/60 bg-muted/40 p-1 backdrop-blur-sm">
      {opts.map((o) => {
        const on = active === o;
        return (
          <motion.button
            key={o}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(o)}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Sparkline card ───────────────────────────────────────────────────────────

function SparklineCard({
  name,
  muscleGroup,
  dataPoints,
  trend,
  onClick,
}: {
  name: string;
  muscleGroup: string;
  dataPoints: { date: string; value: number }[];
  trend: number;
  onClick: () => void;
}) {
  const trendLabel =
    trend > 0 ? `+${Math.round(trend)}%` : trend < 0 ? `${Math.round(trend)}%` : "No change";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-3 text-left transition-all hover:border-primary/30 hover:bg-card/80"
    >
      <p className="truncate text-xs font-semibold text-foreground">{name}</p>
      <p className="text-[10px] capitalize text-muted-foreground">
        {muscleGroup?.replace("_", " ")}
      </p>

      <div className="mt-1.5 h-[60px] w-full">
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
      </div>

      <div className="mt-1 flex justify-end">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            trend > 0
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
              : trend < 0
                ? "border-red-400/20 bg-red-400/10 text-red-400"
                : "border-border/60 bg-muted/30 text-muted-foreground"
          )}
        >
          {trendLabel}
        </span>
      </div>
    </motion.button>
  );
}

// ─── Custom Tooltips ─────────────────────────────────────────────────────────

function SingleTooltip({
  active,
  payload,
  unitLabel = "lbs",
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
  unitLabel = "lbs",
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
  unitLabel = "lbs",
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

// ─── Empty / Loading states ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[260px] w-full rounded-2xl" />
    </div>
  );
}

function SparklineSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[130px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Chart theme ─────────────────────────────────────────────────────────────

const GRID_STROKE = "rgba(255,255,255,0.05)";
const TICK_STYLE = { fill: "rgba(255,255,255,0.4)", fontSize: 10 };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const supabase = useMemo(() => createClient(), []);
  const { preference: unitPreference, unitLabel } = useUnitPreferenceStore();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<RawSet[]>([]);
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [strengthMetric, setStrengthMetric] = useState<"score" | "weight">("score");

  const [tab, setTab] = useState("strength");
  const [strengthView, setStrengthView] = useState<"all" | "single">("all");
  const [volumeView, setVolumeView] = useState("Stacked");
  const [recordsFilter, setRecordsFilter] = useState("All");
  const [recordsSearch, setRecordsSearch] = useState("");
  const [recordsShowAll, setRecordsShowAll] = useState(false);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [setsRes, sessionsRes] = await Promise.all([
        supabase
          .from("workout_sets")
          .select(
            `
            session_id, exercise_id, reps, weight_kg, set_type,
            workout_sessions!inner(started_at, status),
            exercises(name, muscle_group)
          `
          )
          .eq("workout_sessions.status", "completed")
          .eq("workout_sessions.user_id", user.id),
        supabase
          .from("workout_sessions")
          .select("id, name, started_at, total_volume_kg")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("started_at", { ascending: true }),
      ]);

      if (!active) return;

      if (setsRes.error) {
        console.error("[Progress] sets query error:", setsRes.error);
      }
      if (sessionsRes.error) {
        console.error("[Progress] sessions query error:", sessionsRes.error);
      }

      const rows = (setsRes.data ?? []) as unknown as RawSet[];
      const sessionRows = (sessionsRes.data ?? []) as RawSession[];
      setSets(rows);
      setSessions(sessionRows);

      const exercisesById = new Map<string, string>();
      for (const row of rows) {
        if (row.exercises?.name)
          exercisesById.set(row.exercise_id, row.exercises.name);
      }
      const options = [...exercisesById.entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      );
      if (options.length > 0) setSelectedExerciseId(options[0][0]);

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const exerciseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of sets) {
      if (s.exercises?.name) byId.set(s.exercise_id, s.exercises.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  function convertWeight(kg: number) {
    return unitPreference === "imperial"
      ? Math.round(kg * 2.20462 * 10) / 10
      : Math.round(kg * 10) / 10;
  }

  // ── Sparklines for "All Exercises" ────────────────────────────────────────

  const allExerciseSparklines = useMemo(() => {
    const byExercise = new Map<
      string,
      {
        name: string;
        muscleGroup: string;
        sessions: Map<string, { rawDate: string; topScore: number; topWeight: number }>;
      }
    >();

    for (const s of sets) {
      if (!s.exercises?.name || s.weight_kg == null) continue;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;

      let exercise = byExercise.get(s.exercise_id);
      if (!exercise) {
        exercise = {
          name: s.exercises.name,
          muscleGroup: s.exercises.muscle_group,
          sessions: new Map(),
        };
        byExercise.set(s.exercise_id, exercise);
      }

      const existing = exercise.sessions.get(s.session_id);
      if (!existing || score > existing.topScore) {
        exercise.sessions.set(s.session_id, {
          rawDate: s.workout_sessions.started_at,
          topScore: score,
          topWeight: weight,
        });
      }
    }

    return [...byExercise.entries()]
      .map(([id, data]) => {
        const points = [...data.sessions.values()]
          .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
          .map((dp) => ({
            date: format(new Date(dp.rawDate), "MMM d"),
            value: strengthMetric === "score" ? Math.round(dp.topScore) : dp.topWeight,
          }));

        const first = points[0]?.value ?? 0;
        const last = points[points.length - 1]?.value ?? 0;
        const trend = first > 0 ? ((last - first) / first) * 100 : 0;

        return {
          exerciseId: id,
          name: data.name,
          muscleGroup: data.muscleGroup,
          dataPoints: points,
          trend,
        };
      })
      .filter((ex) => ex.dataPoints.length >= 2)
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, unitPreference, strengthMetric]);

  // ── Single exercise strength data ─────────────────────────────────────────

  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const bySession = new Map<
      string,
      {
        rawDate: string;
        topSetScore: number | null;
        topSetWeight: number;
        topSetReps: number;
        topWeight: number;
        topWeightReps: number;
      }
    >();

    for (const s of sets) {
      if (s.exercise_id !== selectedExerciseId || s.weight_kg == null) continue;
      const rawDate = s.workout_sessions.started_at;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;
      const hasValid = s.reps != null && s.reps > 0;

      const ex = bySession.get(s.session_id);
      if (!ex) {
        bySession.set(s.session_id, {
          rawDate,
          topSetScore: hasValid ? score : null,
          topSetWeight: weight,
          topSetReps: reps,
          topWeight: weight,
          topWeightReps: reps,
        });
        continue;
      }
      if (hasValid && (ex.topSetScore == null || score > ex.topSetScore)) {
        ex.topSetScore = score;
        ex.topSetWeight = weight;
        ex.topSetReps = reps;
      }
      if (weight > ex.topWeight) {
        ex.topWeight = weight;
        ex.topWeightReps = reps;
      }
    }

    return [...bySession.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .filter((v) => (strengthMetric === "weight" ? true : v.topSetScore != null))
      .map((v) => ({
        date: format(new Date(v.rawDate), "MMM d"),
        topSetScore: v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0,
        topSetWeight: v.topSetWeight,
        topSetReps: v.topSetReps,
        topWeight: v.topWeight,
        topWeightReps: v.topWeightReps,
        displayValue:
          strengthMetric === "score"
            ? v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0
            : v.topWeight,
        rawDate: v.rawDate,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, selectedExerciseId, strengthMetric, unitPreference]);

  // Best stats for single exercise view
  const bestStats = useMemo(() => {
    if (strengthData.length === 0) return null;
    let bestWeight = { value: 0, reps: 0, date: "" };
    let bestScore = { value: 0, weight: 0, reps: 0, date: "" };
    for (const d of strengthData) {
      if (d.topWeight > bestWeight.value) {
        bestWeight = { value: d.topWeight, reps: d.topWeightReps, date: d.date };
      }
      if (d.topSetScore > bestScore.value) {
        bestScore = { value: d.topSetScore, weight: d.topSetWeight, reps: d.topSetReps, date: d.date };
      }
    }
    return { bestWeight, bestScore };
  }, [strengthData]);

  // ── Volume by category ────────────────────────────────────────────────────

  const categoryVolumeData = useMemo(() => {
    const sessionMap = new Map<
      string,
      { rawDate: string; categories: Record<string, number> }
    >();

    for (const s of sets) {
      if (s.weight_kg == null || !s.exercises?.muscle_group) continue;
      const weight = unitPreference === "imperial" ? s.weight_kg * 2.20462 : s.weight_kg;
      const volume = weight * (s.reps ?? 0);
      const category = VOLUME_CATEGORIES[s.exercises.muscle_group] ?? "Full Body";

      let session = sessionMap.get(s.session_id);
      if (!session) {
        session = {
          rawDate: s.workout_sessions.started_at,
          categories: { "Upper Body": 0, Legs: 0, Core: 0, "Full Body": 0 },
        };
        sessionMap.set(s.session_id, session);
      }
      session.categories[category] += volume;
    }

    return [...sessionMap.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-30)
      .map((s) => ({
        date: format(new Date(s.rawDate), "MMM d"),
        "Upper Body": Math.round(s.categories["Upper Body"]),
        Legs: Math.round(s.categories["Legs"]),
        Core: Math.round(s.categories["Core"]),
        "Full Body": Math.round(s.categories["Full Body"]),
        total: Math.round(
          s.categories["Upper Body"] + s.categories["Legs"] + s.categories["Core"] + s.categories["Full Body"]
        ),
      }));
  }, [sets, unitPreference]);

  // Volume summary stats
  const volumeStats = useMemo(() => {
    if (categoryVolumeData.length === 0) return null;
    const last = categoryVolumeData[categoryVolumeData.length - 1];
    const avg = categoryVolumeData.reduce((s, d) => s + d.total, 0) / categoryVolumeData.length;
    const prevAvg =
      categoryVolumeData.length > 1
        ? categoryVolumeData.slice(0, -1).reduce((s, d) => s + d.total, 0) / (categoryVolumeData.length - 1)
        : avg;
    const delta = prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : 0;
    return {
      latest: last?.total ?? 0,
      avg: Math.round(avg),
      delta: Math.round(delta * 10) / 10,
    };
  }, [categoryVolumeData]);

  // ── Personal records (no cap) ─────────────────────────────────────────────

  type PR = {
    exerciseId: string;
    name: string;
    muscleGroup: string;
    bestWeight: number;
    bestReps: number;
    bestScore: number;
    dateAchieved: string;
    rawDate: string;
  };

  const personalRecords = useMemo((): PR[] => {
    const prMap = new Map<string, PR>();
    for (const s of sets) {
      const name = s.exercises?.name;
      if (!name) continue;
      const rawDate = s.workout_sessions.started_at;
      const weight = convertWeight(s.weight_kg ?? 0);
      const reps = s.reps ?? 0;
      const score = weight * reps;
      const existing = prMap.get(s.exercise_id);
      if (!existing || score > existing.bestScore) {
        prMap.set(s.exercise_id, {
          name,
          exerciseId: s.exercise_id,
          muscleGroup: s.exercises?.muscle_group ?? "",
          bestWeight: weight,
          bestReps: reps,
          bestScore: score,
          dateAchieved: format(new Date(rawDate), "MMM d, yyyy"),
          rawDate,
        });
      }
    }
    return [...prMap.values()].sort((a, b) => b.bestScore - a.bestScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, unitPreference]);

  const filteredRecords = useMemo(() => {
    let result = personalRecords;
    if (recordsFilter !== "All") {
      const key = recordsFilter.toLowerCase().replace(" ", "_");
      result = result.filter((pr) => pr.muscleGroup === key);
    }
    if (recordsSearch.trim()) {
      const q = recordsSearch.toLowerCase().trim();
      result = result.filter((pr) => pr.name.toLowerCase().includes(q));
    }
    return result;
  }, [personalRecords, recordsFilter, recordsSearch]);

  const recordFilterPills = useMemo(() => {
    const groups = new Set(personalRecords.map((pr) => pr.muscleGroup).filter(Boolean));
    const pills = ["All"];
    for (const g of MUSCLE_GROUPS) {
      if (groups.has(g)) pills.push(MUSCLE_GROUP_LABELS[g] ?? g);
    }
    return pills;
  }, [personalRecords]);

  const selectedExerciseName = useMemo(
    () => exerciseOptions.find((o) => o.id === selectedExerciseId)?.name ?? "",
    [exerciseOptions, selectedExerciseId]
  );

  // Total stats for header
  const totalPRs = personalRecords.length;
  const totalSessions = sessions.length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md pb-28">
        {/* Header */}
        <div className="px-5 pb-5 pt-5">
          <div className="mb-4 flex items-center gap-3">
            <Link
              href="/history"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                Analytics
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>
            </div>
          </div>

          {!loading && totalSessions > 0 && (
            <p className="mb-4 text-[13px] text-muted-foreground">
              {totalSessions} session{totalSessions !== 1 ? "s" : ""} · {totalPRs} PR
              {totalPRs !== 1 ? "s" : ""}
            </p>
          )}

          <TabBar active={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            {/* ── STRENGTH TAB ─────────────────────────────────────────── */}
            {tab === "strength" && (
              <motion.div
                key="strength"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <SparklineSkeleton />
                ) : exerciseOptions.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {strengthView === "all" ? (
                      <motion.div
                        key="all"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="All Exercises"
                            onChange={(v) => v === "Single Exercise" && setStrengthView("single")}
                          />
                        </div>
                        <div className="mb-4">
                          <PillToggle
                            opts={["Top Set Score", "Top Weight"]}
                            active={strengthMetric === "score" ? "Top Set Score" : "Top Weight"}
                            onChange={(v) => setStrengthMetric(v === "Top Set Score" ? "score" : "weight")}
                          />
                        </div>

                        {allExerciseSparklines.length === 0 ? (
                          <EmptyState message="Need at least 2 sessions per exercise to show trends" />
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5">
                            {allExerciseSparklines.map((ex) => (
                              <SparklineCard
                                key={ex.exerciseId}
                                name={ex.name}
                                muscleGroup={ex.muscleGroup}
                                dataPoints={ex.dataPoints}
                                trend={ex.trend}
                                onClick={() => {
                                  setSelectedExerciseId(ex.exerciseId);
                                  setStrengthView("single");
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="single"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => setStrengthView("all")}
                          className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-primary transition hover:text-primary/80"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to overview
                        </button>

                        {/* Exercise dropdown */}
                        <div className="relative mb-4">
                          <select
                            value={selectedExerciseId}
                            onChange={(e) => setSelectedExerciseId(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-border/60 bg-card px-4 py-2.5 pr-10 text-sm font-semibold text-foreground transition focus:border-primary/40 focus:outline-none"
                          >
                            {exerciseOptions.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>

                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="Single Exercise"
                            onChange={(v) => v === "All Exercises" && setStrengthView("all")}
                          />
                        </div>

                        {strengthData.length === 0 ? (
                          <EmptyState message="No data for this exercise" />
                        ) : (
                          <>
                            <div className="mb-4 rounded-2xl border border-border/60 bg-card/60 p-4">
                              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {strengthMetric === "score" ? "Top Set Score" : `Max Weight (${unitLabel})`}
                              </p>
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
                            </div>

                            {/* Best stats pills */}
                            {bestStats && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                                  <p className="mb-1 text-[10px] text-muted-foreground">Best Weight</p>
                                  <p className="text-base font-bold text-primary">
                                    {bestStats.bestWeight.value} {unitLabel}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {bestStats.bestWeight.date} · {bestStats.bestWeight.reps} reps
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                                  <p className="mb-1 text-[10px] text-muted-foreground">Best Score</p>
                                  <p className="text-base font-bold text-primary">
                                    {Math.round(bestStats.bestScore.value).toLocaleString()} pts
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {bestStats.bestScore.date} · {bestStats.bestScore.reps} reps
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

            {/* ── VOLUME TAB ───────────────────────────────────────────── */}
            {tab === "volume" && (
              <motion.div
                key="volume"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <ChartSkeleton />
                ) : categoryVolumeData.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {volumeView === "Stacked" ? (
                      <motion.div
                        key="stacked"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        {/* Legend */}
                        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => (
                            <div key={cat} className="flex items-center gap-1.5">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ background: VOLUME_CATEGORY_COLORS[cat] }}
                              />
                              <span className="text-[11px] text-muted-foreground">{cat}</span>
                            </div>
                          ))}
                        </div>

                        {/* Stacked chart */}
                        <div className="mb-4 rounded-2xl border border-border/60 bg-card/60 p-4">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Session Volume ({unitLabel})
                          </p>
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
                              {VOLUME_CATEGORY_ORDER.map((cat, i) => (
                                <Bar
                                  key={cat}
                                  dataKey={cat}
                                  name={cat}
                                  stackId="a"
                                  fill={VOLUME_CATEGORY_COLORS[cat]}
                                  radius={i === VOLUME_CATEGORY_ORDER.length - 1 ? [4, 4, 0, 0] : undefined}
                                  isAnimationActive={false}
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Volume summary */}
                        {volumeStats && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                              <p className="mb-1 text-[10px] text-muted-foreground">Latest Session</p>
                              <p className="text-base font-bold text-foreground">
                                {(volumeStats.latest / 1000).toFixed(1)}k {unitLabel}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                              <p className="mb-1 text-[10px] text-muted-foreground">Avg / Session</p>
                              <p className="text-base font-bold text-foreground">
                                {(volumeStats.avg / 1000).toFixed(1)}k {unitLabel}
                              </p>
                              {volumeStats.delta !== 0 && (
                                <span
                                  className={cn(
                                    "text-[10px] font-bold",
                                    volumeStats.delta > 0 ? "text-emerald-400" : "text-red-400"
                                  )}
                                >
                                  {volumeStats.delta > 0 ? "+" : ""}
                                  {volumeStats.delta}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="bycategory"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => {
                            const color = VOLUME_CATEGORY_COLORS[cat];
                            const hasData = categoryVolumeData.some(
                              (d) => (d[cat as keyof typeof d] as number) > 0
                            );
                            return (
                              <div key={cat} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-3">
                                <p className="mb-2.5 text-xs font-semibold" style={{ color }}>
                                  {cat}
                                </p>
                                {!hasData ? (
                                  <p className="py-8 text-center text-[10px] text-muted-foreground">No data</p>
                                ) : (
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
                                      <Bar dataKey={cat} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} opacity={0.85} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

            {/* ── RECORDS TAB ──────────────────────────────────────────── */}
            {tab === "records" && (
              <motion.div
                key="records"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : personalRecords.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={recordsSearch}
                        onChange={(e) => {
                          setRecordsSearch(e.target.value);
                          setRecordsShowAll(false);
                        }}
                        placeholder="Search exercises..."
                        className="rounded-xl border-border/60 bg-card pl-10"
                      />
                    </div>

                    {/* Filter pills */}
                    <div className="-mx-4 mb-3 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
                      <div className="flex w-max gap-1.5">
                        {recordFilterPills.map((pill) => {
                          const on = recordsFilter === pill;
                          return (
                            <motion.button
                              key={pill}
                              whileTap={{ scale: 0.94 }}
                              onClick={() => {
                                setRecordsFilter(pill);
                                setRecordsShowAll(false);
                              }}
                              className={cn(
                                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                                on
                                  ? "border-primary/25 bg-primary/15 text-primary"
                                  : "border-border/60 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {pill}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Count */}
                    <p className="mb-3 text-xs text-muted-foreground">
                      {filteredRecords.length < personalRecords.length
                        ? `${filteredRecords.length} of ${personalRecords.length} records`
                        : `${personalRecords.length} records`}
                    </p>

                    {/* PR cards */}
                    {filteredRecords.length === 0 ? (
                      <EmptyState message="No records match your search" />
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          <AnimatePresence mode="popLayout">
                            {filteredRecords
                              .slice(0, recordsShowAll ? undefined : 50)
                              .map((pr, i) => (
                                <motion.div
                                  key={pr.exerciseId}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.2, delay: i * 0.03 }}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="mb-1 truncate text-[13px] font-semibold text-foreground">
                                      {pr.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {pr.muscleGroup && (
                                        <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                          {pr.muscleGroup.replace("_", " ")}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-muted-foreground">
                                        {pr.dateAchieved}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {pr.bestWeight} {unitLabel} × {pr.bestReps}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                                    <Trophy className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-bold text-primary">
                                      {Math.round(pr.bestScore).toLocaleString()}
                                    </span>
                                  </div>
                                </motion.div>
                              ))}
                          </AnimatePresence>
                        </div>

                        {!recordsShowAll && filteredRecords.length > 50 && (
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setRecordsShowAll(true)}
                            className="mt-4 w-full rounded-xl border border-border/60 bg-transparent py-3 text-[13px] font-semibold text-muted-foreground transition-all hover:border-primary/25 hover:text-primary"
                          >
                            Show all {filteredRecords.length} records
                          </motion.button>
                        )}
                      </>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
