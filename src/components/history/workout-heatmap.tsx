"use client";

import { useMemo } from "react";
import { format, subDays, startOfDay, getDay } from "date-fns";
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
    return "bg-primary";
  }

  const totalSessions = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-foreground">Workout Activity</p>
        <p className="text-[11px] text-muted-foreground">
          {totalSessions} sessions · {activeDays} active days
        </p>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: totalCols * 13 + 24 }}>
          {/* Month labels */}
          <div className="relative mb-0.5 ml-6 h-4">
            {monthLabels.map(({ col, label }) => (
              <span
                key={`${col}-${label}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: col * 13 }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Grid: day labels + cells */}
          <div className="flex gap-0.5">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-0.5 pr-1">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-[11px] items-center text-[9px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Columns (weeks) */}
            {Array.from({ length: totalCols }).map((_, col) => (
              <div key={col} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }).map((_, row) => {
                  const item = paddedDays[col * 7 + row];
                  if (!item) {
                    return <div key={row} className="h-[11px] w-[11px]" />;
                  }
                  return (
                    <div
                      key={row}
                      title={`${item.date}: ${item.count} session${item.count !== 1 ? "s" : ""}`}
                      className={cn(
                        "h-[11px] w-[11px] rounded-[2px] transition-opacity hover:opacity-80",
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
            <span className="text-[9px] text-muted-foreground">Less</span>
            {[0, 1, 2, 3].map((level) => (
              <div
                key={level}
                className={cn(
                  "h-[11px] w-[11px] rounded-[2px]",
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
            <span className="text-[9px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
