import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryNav } from "@/components/history/history-nav";
import {
  BarChart3,
  Dumbbell,
  Calendar,
  Clock,
  Flame,
  Weight,
  TrendingUp,
} from "lucide-react";

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

function longestStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

export default async function HistoryStatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [sessionsResult, setsResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("started_at, duration_seconds, total_volume_kg")
      .eq("user_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("workout_sets")
      .select("exercises!inner(muscle_group), workout_sessions!inner(user_id, status)")
      .eq("workout_sessions.user_id", user.id)
      .eq("workout_sessions.status", "completed"),
  ]);

  type SessionRow = { started_at: string; duration_seconds: number | null; total_volume_kg: number | null };
  type SetRow = {
    exercises: { muscle_group: string } | { muscle_group: string }[] | null;
    workout_sessions: { user_id: string; status: string } | null;
  };

  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const sets = (setsResult.data ?? []) as unknown as SetRow[];

  const totalSessions = sessions.length;
  const totalVolume = sessions.reduce((sum, s) => sum + (s.total_volume_kg ?? 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

  const workoutDates = sessions.map((s) => s.started_at.slice(0, 10));
  const streak = longestStreak(workoutDates);

  // Muscle group frequency
  const muscleCount: Record<string, number> = {};
  for (const s of sets) {
    const ex = s.exercises;
    const mg = Array.isArray(ex) ? ex[0]?.muscle_group : ex?.muscle_group;
    if (mg) muscleCount[mg] = (muscleCount[mg] ?? 0) + 1;
  }
  const topMuscles = Object.entries(muscleCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxCount = topMuscles[0]?.[1] ?? 1;

  // Monthly breakdown (last 6 months)
  const monthMap: Record<string, { sessions: number; volume: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { sessions: 0, volume: 0 };
  }
  for (const s of sessions) {
    const key = s.started_at.slice(0, 7);
    if (monthMap[key]) {
      monthMap[key].sessions++;
      monthMap[key].volume += s.total_volume_kg ?? 0;
    }
  }
  const months = Object.entries(monthMap);

  const STAT_CARDS = [
    { icon: Dumbbell, label: "Total Sessions", value: totalSessions.toLocaleString(), color: "text-primary" },
    { icon: Weight, label: "Total Volume", value: formatVolume(totalVolume), color: "text-amber-400" },
    { icon: Clock, label: "Avg Session", value: avgDuration > 0 ? formatDuration(avgDuration) : "—", color: "text-sky-400" },
    { icon: Flame, label: "Longest Streak", value: `${streak}d`, color: "text-rose-400" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Workout Stats</h1>
        </div>
        <HistoryNav />
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-border/60 bg-card/30 p-4 text-center"
          >
            <Icon className={`mx-auto mb-1.5 h-5 w-5 ${color}`} />
            <p className="text-[24px] font-black tabular-nums leading-none">{value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Muscle Group Bar Chart ──────────────────────────────────── */}
      {topMuscles.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-[13px] font-bold">Top Muscle Groups</p>
          </div>
          <div className="space-y-2">
            {topMuscles.map(([mg, count]) => (
              <div key={mg} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="capitalize font-medium">{mg}</span>
                  <span className="text-muted-foreground tabular-nums">{count} sets</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Breakdown ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-bold">Last 6 Months</p>
        </div>
        <div className="space-y-2">
          {months.map(([key, data]) => {
            const [year, month] = key.split("-");
            const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            });
            return (
              <div key={key} className="flex items-center gap-3 text-[12px]">
                <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(2, (data.sessions / Math.max(...months.map(([, d]) => d.sessions), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">
                    {data.sessions} sess
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalSessions === 0 && (
        <div className="py-16 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No workouts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Complete your first workout to see stats here.</p>
        </div>
      )}
    </div>
  );
}
