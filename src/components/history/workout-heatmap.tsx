"use client";

import { useMemo } from "react";
import { format, subDays, startOfDay, getDay } from "date-fns";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkoutDay = {
  date: string; // yyyy-MM-dd
  count: number;
};

interface WorkoutHeatmapProps {
  /** Map of "yyyy-MM-dd" → number of sessions */
  sessionsByDay: Map<string, unknown[]>;
  /** Total weeks to show (default 26 = 6 months) */
  weeks?: number;
}

// ─── Month labels ─────────────────────────────────────────────────────────────

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkoutHeatmap({ sessionsByDay, weeks = 26 }: WorkoutHeatmapProps) {
  const days = useMemo<WorkoutDay[]>(() => {
    const today = startOfDay(new Date());
    const totalDays = weeks * 7;
    const result: WorkoutDay[] = [];

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      result.push({ date: key, count: (sessionsByDay.get(key) ?? []).length });
    }
    return result;
  }, [sessionsByDay, weeks]);

  // Pad so the first day of the grid aligns to Monday (day 1)
  const firstDay = days[0] ? new Date(`${days[0].date}T12:00:00`) : new Date();
  const startPad = (getDay(firstDay) + 6) % 7; // Mon=0

  const paddedDays: (WorkoutDay | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...days,
  ];

  // Find month boundaries for labels
  const monthLabels: { col: number; label: string }[] = [];
  let prevMonth = "";
  paddedDays.forEach((d, i) => {
    if (!d) return;
    const col = Math.floor(i / 7);
    const month = d.date.slice(5, 7);
    if (month !== prevMonth) {
      prevMonth = month;
      monthLabels.push({ col, label: format(new Date(`${d.date}T12:00:00`), "MMM") });
    }
  });

  const totalCols = Math.ceil(paddedDays.length / 7);

  function cellColor(count: number) {
    if (count === 0) return "bg-muted/40";
    if (count === 1) return "bg-primary/40";
    if (count === 2) return "bg-primary/65";
    return "bg-primary shadow-[0_0_6px_var(--phase-current-glow,oklch(0.78_0.16_195_/_0.20))]";
  }

  const totalSessions = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div className="glass-surface glass-highlight rounded-2xl p-5">
      {/* Premium header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <p className="text-[13px] font-bold text-foreground">Activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {totalSessions} sessions
          </span>
          <span className="text-[11px] text-muted-foreground">
            {activeDays} active days
          </span>
        </div>
      </div>

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: totalCols * 16 + 28 }}>
          {/* Month labels */}
          <div className="relative mb-0.5 ml-7 h-4">
            {monthLabels.map(({ col, label }) => (
              <span
                key={`${col}-${label}`}
                className="absolute text-[10px] font-medium text-muted-foreground"
                style={{ left: col * 16 }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Grid: day labels + cells */}
          <div className="flex gap-[2px]">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[2px] pr-1">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-3.5 items-center text-[10px] font-semibold text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Columns (weeks) */}
            {Array.from({ length: totalCols }).map((_, col) => (
              <div key={col} className="flex flex-col gap-[2px]">
                {Array.from({ length: 7 }).map((_, row) => {
                  const item = paddedDays[col * 7 + row];
                  if (!item) {
                    return <div key={row} className="h-3.5 w-3.5" />;
                  }
                  return (
                    <div
                      key={row}
                      title={`${item.date}: ${item.count} session${item.count !== 1 ? "s" : ""}`}
                      className={cn(
                        "h-3.5 w-3.5 rounded-[2px] transition-opacity hover:opacity-80",
                        cellColor(item.count)
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Less</span>
            {[0, 1, 2, 3].map((level) => (
              <div
                key={level}
                className={cn(
                  "h-3.5 w-3.5 rounded-[2px]",
                  level === 0
                    ? "bg-muted/40"
                    : level === 1
                    ? "bg-primary/40"
                    : level === 2
                    ? "bg-primary/65"
                    : "bg-primary"
                )}
              />
            ))}
            <span className="text-[10px] font-medium text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
