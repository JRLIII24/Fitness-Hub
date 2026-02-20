"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PillSelector } from "@/components/ui/pill-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Dumbbell, Trophy, ArrowLeft, BarChart3 } from "lucide-react";

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

// ─── Chart theme constants ────────────────────────────────────────────────────

const GRID_COLOR = "rgba(255,255,255,0.07)";
const TICK_COLOR = "rgba(255,255,255,0.5)";
const TICK_FONT_SIZE = 11;
const CHART_COLOR = "var(--primary)";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

type StrengthTooltipPayload = {
  date: string;
  topSetScore: number;
  topSetWeight: number;
  topSetReps: number;
  topWeight: number;
  topWeightReps: number;
};

function StrengthTooltip({
  active,
  payload,
  metric,
  unitLabel = "lbs",
}: {
  active?: boolean;
  payload?: { payload: StrengthTooltipPayload }[];
  metric: "score" | "weight";
  unitLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{d.date}</p>
      <p className="text-muted-foreground">
        <span className="text-primary font-semibold">{d.topWeight} {unitLabel}</span>{" "}
        best weight ({d.topWeightReps} reps)
      </p>
      <p className="text-muted-foreground">
        <span className="text-primary font-semibold">{d.topSetWeight} {unitLabel}</span>{" "}
        &times; {d.topSetReps} reps ={" "}
        <span className="text-primary font-semibold">{Math.round(d.topSetScore).toLocaleString()}</span>
      </p>
      <p className="text-muted-foreground">
        Showing:{" "}
        <span className="text-primary font-semibold">
          {metric === "score" ? "Top Set Score" : "Top Weight"}
        </span>
      </p>
    </div>
  );
}

function VolumeTooltip({
  active,
  payload,
  label,
  unitLabel = "lbs",
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unitLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        Volume:{" "}
        <span className="text-primary font-semibold">
          {payload[0].value.toLocaleString()} {unitLabel}
        </span>
      </p>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Dumbbell className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[260px] w-full rounded-xl" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const supabase = useMemo(() => createClient(), []);
  const { preference: unitPreference, unitLabel } = useUnitPreferenceStore();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<RawSet[]>([]);
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [strengthMetric, setStrengthMetric] = useState<"score" | "weight">("score");

  // ── Fetch all completed sets ──────────────────────────────────────────────

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
          .eq("workout_sessions.user_id", user.id)
          .order("workout_sessions.started_at", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select("id, name, started_at, total_volume_kg")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("started_at", { ascending: true }),
      ]);

      if (!active) return;

      const rows = (setsRes.data ?? []) as unknown as RawSet[];
      const sessionRows = (sessionsRes.data ?? []) as RawSession[];
      setSets(rows);
      setSessions(sessionRows);

      const exercisesById = new Map<string, string>();
      for (const row of rows) {
        if (row.exercises?.name) exercisesById.set(row.exercise_id, row.exercises.name);
      }
      const options = [...exercisesById.entries()].sort((a, b) => a[1].localeCompare(b[1]));
      if (options.length > 0) setSelectedExerciseId(options[0][0]);

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  // ── Distinct exercise names (for the selector) ────────────────────────────

  const exerciseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of sets) {
      if (s.exercises?.name) byId.set(s.exercise_id, s.exercises.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  // ── Strength chart data ───────────────────────────────────────────────────

  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const bySession = new Map<string, {
      rawDate: string;
      topSetScore: number | null;
      topSetWeight: number;
      topSetReps: number;
      topWeight: number;
      topWeightReps: number;
    }>();

    for (const s of sets) {
      if (s.exercise_id !== selectedExerciseId) continue;
      if (s.weight_kg == null) continue;

      const rawDate = s.workout_sessions.started_at;
      const weight = unitPreference === "imperial"
        ? Math.round((s.weight_kg ?? 0) * 2.20462 * 10) / 10
        : Math.round((s.weight_kg ?? 0) * 10) / 10;
      const reps = s.reps ?? 0;
      const strengthScore = weight * reps;
      const hasValidScore = s.reps != null && s.reps > 0;

      const existing = bySession.get(s.session_id);
      if (!existing) {
        bySession.set(s.session_id, {
          rawDate,
          topSetScore: hasValidScore ? strengthScore : null,
          topSetWeight: weight,
          topSetReps: reps,
          topWeight: weight,
          topWeightReps: reps,
        });
        continue;
      }

      if (hasValidScore && (existing.topSetScore == null || strengthScore > existing.topSetScore)) {
        existing.topSetScore = strengthScore;
        existing.topSetWeight = weight;
        existing.topSetReps = reps;
      }
      if (weight > existing.topWeight) {
        existing.topWeight = weight;
        existing.topWeightReps = reps;
      }
    }

    return [...bySession.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .filter((val) => (strengthMetric === "weight" ? true : val.topSetScore != null))
      .map((val) => ({
        date: format(new Date(val.rawDate), "MMM d"),
        topSetScore: val.topSetScore != null ? Math.round(val.topSetScore * 10) / 10 : 0,
        topSetWeight: val.topSetWeight,
        topSetReps: val.topSetReps,
        topWeight: val.topWeight,
        topWeightReps: val.topWeightReps,
        displayValue:
          strengthMetric === "score"
            ? (val.topSetScore != null ? Math.round(val.topSetScore * 10) / 10 : 0)
            : val.topWeight,
        rawDate: val.rawDate,
      }));
  }, [sets, selectedExerciseId, strengthMetric, unitPreference]);

  // ── Session volume data ───────────────────────────────────────────────────

  const sessionVolumeData = useMemo(() => {
    return sessions
      .filter((s) => s.total_volume_kg != null)
      .map((s) => {
        const volume = unitPreference === "imperial"
          ? (s.total_volume_kg ?? 0) * 2.20462
          : (s.total_volume_kg ?? 0);
        return {
          date: format(new Date(s.started_at), "MMM d"),
          volume: Math.round(volume),
          rawDate: s.started_at,
          workoutName: s.name,
        };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-30);
  }, [sessions, unitPreference]);

  // ── Personal records ──────────────────────────────────────────────────────

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
      const weight = unitPreference === "imperial"
        ? Math.round((s.weight_kg ?? 0) * 2.20462 * 10) / 10
        : Math.round((s.weight_kg ?? 0) * 10) / 10;
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

    return [...prMap.values()]
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 50);
  }, [sets, unitPreference]);

  const selectedExerciseName = useMemo(() => {
    return exerciseOptions.find((option) => option.id === selectedExerciseId)?.name ?? "";
  }, [exerciseOptions, selectedExerciseId]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-6 pb-28 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/history"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition hover:border-white/20 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-xs text-muted-foreground">
            Strength over time, session volume, and PR records
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="strength" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="strength" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Strength
          </TabsTrigger>
          <TabsTrigger value="volume" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            Volume
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="h-3.5 w-3.5" />
            Records
          </TabsTrigger>
        </TabsList>

        {/* ── Section 1: Strength ──────────────────────────────────────────── */}
        <TabsContent value="strength" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Strength Over Time
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Track top set score or top weight by workout date
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <ChartSkeleton />
              ) : exerciseOptions.length === 0 ? (
                <EmptyState message="No data yet — start logging workouts" />
              ) : (
                <>
                  <Select
                    value={selectedExerciseId}
                    onValueChange={setSelectedExerciseId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select exercise" />
                    </SelectTrigger>
                    <SelectContent>
                      {exerciseOptions.map((exercise) => (
                        <SelectItem key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <PillSelector
                    ariaLabel="Strength metric"
                    className="w-full"
                    value={strengthMetric}
                    onChange={setStrengthMetric}
                    options={[
                      { value: "score", label: "Top Set Score" },
                      { value: "weight", label: "Top Weight" },
                    ]}
                  />

                  {strengthData.length === 0 ? (
                    <EmptyState message="No data for this exercise" />
                  ) : (
                    <>
                      {selectedExerciseName ? (
                        <p className="text-xs text-muted-foreground">
                          Tracking: <span className="font-medium text-foreground">{selectedExerciseName}</span>
                        </p>
                      ) : null}
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart
                          data={strengthData}
                          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={GRID_COLOR}
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: TICK_COLOR, fontSize: TICK_FONT_SIZE }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: TICK_COLOR, fontSize: TICK_FONT_SIZE }}
                            axisLine={false}
                            tickLine={false}
                            unit={strengthMetric === "weight" ? ` ${unitLabel}` : ""}
                          />
                          <Tooltip
                            content={
                              <StrengthTooltip
                                metric={strengthMetric}
                                unitLabel={unitLabel}
                              />
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="displayValue"
                            stroke={CHART_COLOR}
                            strokeWidth={2}
                            dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: CHART_COLOR, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Section 2: Volume ────────────────────────────────────────────── */}
        <TabsContent value="volume" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Session Volume
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Total session lift volume by date ({unitLabel}) — latest 30 workouts
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton />
              ) : sessionVolumeData.length === 0 ? (
                <EmptyState message="No data yet — start logging workouts" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={sessionVolumeData}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_COLOR}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: TICK_COLOR, fontSize: TICK_FONT_SIZE }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: TICK_COLOR, fontSize: TICK_FONT_SIZE }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<VolumeTooltip unitLabel={unitLabel} />} />
                    <Bar
                      dataKey="volume"
                      fill={CHART_COLOR}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Section 3: Records ───────────────────────────────────────────── */}
        <TabsContent value="records" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-primary" />
                Personal Records
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Best set score per exercise (weight × reps)
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : personalRecords.length === 0 ? (
                <EmptyState message="No data yet — start logging workouts" />
              ) : (
                <ul className="space-y-2">
                  {personalRecords.map((pr) => (
                    <li
                      key={pr.exerciseId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-card/60 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {pr.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {pr.muscleGroup && (
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 text-[10px] font-normal capitalize"
                            >
                              {pr.muscleGroup}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {pr.dateAchieved}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {pr.bestWeight} {unitLabel} × {pr.bestReps}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-semibold text-primary">
                          {Math.round(pr.bestScore).toLocaleString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
