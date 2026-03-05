"use client";

import { Dumbbell } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";

interface ExerciseHistoryData {
  exercise_name: string;
  sessions: Array<{
    date: string;
    sets: Array<{
      weight_kg: number;
      reps: number;
      rpe?: number;
    }>;
  }>;
}

interface ExerciseHistoryCardProps {
  data: ExerciseHistoryData;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function summarizeSets(
  sets: ExerciseHistoryData["sessions"][0]["sets"],
  isImperial: boolean
): string {
  return sets
    .map((s) => {
      const w = weightToDisplay(s.weight_kg, isImperial, 0);
      const unit = isImperial ? "lb" : "kg";
      const rpeStr = s.rpe ? ` @${s.rpe}` : "";
      return `${w}${unit} x ${s.reps}${rpeStr}`;
    })
    .join(", ");
}

export function ExerciseHistoryCard({ data }: ExerciseHistoryCardProps) {
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Dumbbell className="h-3.5 w-3.5 text-primary" />
        <h4 className="text-[12px] font-bold text-foreground">
          {data.exercise_name}
        </h4>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
          Last {data.sessions.length} sessions
        </span>
      </div>

      {/* Compact table */}
      <div className="flex flex-col gap-1">
        {/* Header row */}
        <div className="grid grid-cols-[60px_1fr] gap-2 px-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Date
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Sets
          </span>
        </div>

        {data.sessions.map((session, i) => (
          <div
            key={session.date}
            className={`grid grid-cols-[60px_1fr] gap-2 rounded-lg px-1 py-1 ${
              i % 2 === 0 ? "bg-card/30" : ""
            }`}
          >
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {formatDate(session.date)}
            </span>
            <span className="text-[11px] text-foreground truncate">
              {summarizeSets(session.sets, isImperial)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
