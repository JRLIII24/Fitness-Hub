"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { HistoryNav } from "@/components/history/history-nav";
import type { HistoryStatsResponse } from "@/app/api/history/stats/route";
import {
  BarChart3,
  Dumbbell,
  CalendarDays,
  Clock,
  Flame,
  Weight,
} from "lucide-react";

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number, isImperial: boolean) {
  if (isImperial) {
    const lbs = kgToLbs(kg);
    if (lbs >= 2000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${Math.round(lbs).toLocaleString()} lbs`;
  }
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export default function HistoryStatsPage() {
  const router = useRouter();
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [stats, setStats] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch("/api/history/stats");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;

      const data: HistoryStatsResponse = await res.json();
      if (active) {
        setStats(data);
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [router]);

  const maxCount = stats?.top_muscle_groups[0]?.set_count ?? 1;

  const months = useMemo(() => {
    if (!stats) return [];
    // Fill in missing months from last 6 months
    const monthMap: Record<string, { sessions: number; volume_kg: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { sessions: 0, volume_kg: 0 };
    }
    for (const m of stats.monthly_breakdown) {
      if (monthMap[m.month_key]) {
        monthMap[m.month_key] = { sessions: m.sessions, volume_kg: m.volume_kg };
      }
    }
    return Object.entries(monthMap);
  }, [stats]);

  const STAT_CARDS = stats
    ? [
        { icon: Dumbbell, label: "Total Sessions", value: stats.total_sessions.toLocaleString(), color: "text-primary" },
        { icon: Weight, label: "Total Volume", value: formatVolume(stats.total_volume_kg, isImperial), color: "text-amber-400" },
        { icon: Clock, label: "Avg Session", value: stats.avg_duration_seconds > 0 ? formatDuration(stats.avg_duration_seconds) : "—", color: "text-sky-400" },
        { icon: Flame, label: "Longest Streak", value: `${stats.longest_streak}d`, color: "text-rose-400" },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Workout Stats</h1>
        </div>
        <HistoryNav />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        </div>
      ) : stats && stats.total_sessions > 0 ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/60 bg-card/30 p-5 text-center"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-card/70">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <p className="tabular-nums text-[28px] font-black leading-none text-foreground">{value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Muscle Group Bar Chart */}
          {stats.top_muscle_groups.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <Dumbbell className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-bold">Top Muscle Groups</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="p-5 space-y-3">
                {stats.top_muscle_groups.map(({ muscle_group, set_count }) => (
                  <div key={muscle_group} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium capitalize">{muscle_group}</span>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{set_count} sets</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(set_count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Breakdown */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-bold">Monthly Breakdown</span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="p-5 space-y-2.5">
              {months.map(([key, data]) => {
                const [year, month] = key.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", {
                  month: "short",
                  year: "2-digit",
                });
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3">
                    <span className="text-[12px] font-semibold">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-[13px] font-bold text-foreground">
                        {data.sessions} sessions
                      </span>
                      <span className="tabular-nums text-[13px] font-bold text-muted-foreground">
                        {formatVolume(data.volume_kg, isImperial)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No workouts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Complete your first workout to see stats here.</p>
        </div>
      )}
    </div>
  );
}
