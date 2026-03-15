"use client";

import { Y2K } from "@/lib/pods/y2k-tokens";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

interface WeekDotsProps {
  plannedDays: string[];     // e.g. ['mon','wed','fri']
  completedDays: string[];   // e.g. ['mon','wed']
}

function getTodayKey(): string {
  const d = new Date().getDay(); // 0=Sun
  return DAYS[d === 0 ? 6 : d - 1]; // Shift to Mon=0
}

export function WeekDots({ plannedDays, completedDays }: WeekDotsProps) {
  const today = getTodayKey();
  const todayIdx = DAYS.indexOf(today as (typeof DAYS)[number]);

  return (
    <div className="flex gap-1">
      {DAYS.map((day, i) => {
        const planned = plannedDays.includes(day);
        const completed = completedDays.includes(day);
        const isToday = day === today;
        const isPast = i < todayIdx;

        let bg: string;
        let border: string;

        if (completed) {
          bg = "rgba(52,211,153,0.15)";
          border = "rgba(52,211,153,0.40)";
        } else if (planned && isPast) {
          // Missed planned day
          bg = "rgba(251,191,36,0.10)";
          border = "rgba(251,191,36,0.30)";
        } else if (planned && isToday) {
          bg = "rgba(0,212,255,0.12)";
          border = "rgba(0,212,255,0.35)";
        } else if (planned) {
          bg = "rgba(255,255,255,0.06)";
          border = "rgba(255,255,255,0.15)";
        } else {
          bg = "transparent";
          border = "rgba(255,255,255,0.06)";
        }

        return (
          <div
            key={day}
            className="flex flex-col items-center"
            style={{ gap: "2px" }}
          >
            <div
              style={{
                width: "24px",
                height: "26px",
                borderRadius: Y2K.r12,
                background: bg,
                border: `1px solid ${border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isToday && planned ? `0 0 8px rgba(0,212,255,0.20)` : undefined,
              }}
            >
              {completed && (
                <div
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "#34D399",
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "7px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: isToday ? Y2K.text1 : Y2K.text3,
                textTransform: "uppercase",
              }}
            >
              {LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
