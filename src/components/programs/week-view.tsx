"use client";

import { motion } from "framer-motion";
import { Dumbbell, Play, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayExercise {
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rpe_target?: number;
  rest_seconds: number;
}

interface ProgramDay {
  day_number: number;
  name: string;
  exercises: DayExercise[];
  template_id?: string;
}

interface ProgramWeek {
  week_number: number;
  focus: string;
  days: ProgramDay[];
}

interface WeekViewProps {
  week: ProgramWeek;
  isCurrentWeek: boolean;
  programStatus: string;
  onStartWorkout?: (templateId: string, dayName: string) => void;
}

export function WeekView({ week, isCurrentWeek, programStatus, onStartWorkout }: WeekViewProps) {
  return (
    <div className="space-y-3">
      {/* Week focus */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
            isCurrentWeek
              ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
              : "bg-muted/30 text-muted-foreground border border-border/40",
          )}
        >
          Week {week.week_number}
        </span>
        <span className="text-[11px] text-muted-foreground">{week.focus}</span>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {week.days.map((day) => (
          <DayCard
            key={day.day_number}
            day={day}
            canStart={programStatus === "active" && !!day.template_id}
            onStartWorkout={onStartWorkout}
          />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  day,
  canStart,
  onStartWorkout,
}: {
  day: ProgramDay;
  canStart: boolean;
  onStartWorkout?: (templateId: string, dayName: string) => void;
}) {
  const totalSets = day.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const muscleGroups = [...new Set(day.exercises.map((ex) => ex.muscle_group))];
  const estimatedMin = Math.round(totalSets * 2.5); // ~2.5 min per set

  return (
    <motion.div
      whileTap={canStart ? { scale: 0.97 } : undefined}
      className="rounded-xl border border-border/50 bg-card/40 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Day {day.day_number}
            </span>
            <span className="text-[12px] font-bold text-foreground">{day.name}</span>
          </div>

          {/* Exercise list */}
          <div className="mt-2 space-y-1">
            {day.exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <Dumbbell className="size-2.5 text-muted-foreground/60" />
                <span className="text-muted-foreground">
                  {ex.exercise_name}
                </span>
                <span className="ml-auto tabular-nums font-semibold text-foreground/70">
                  {ex.sets}×{ex.reps}
                  {ex.rpe_target ? ` @${ex.rpe_target}` : ""}
                </span>
              </div>
            ))}
          </div>

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Dumbbell className="size-2.5" />
              {totalSets} sets
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-2.5" />
              ~{estimatedMin}min
            </span>
            <span>{muscleGroups.join(", ")}</span>
          </div>
        </div>

        {/* Start button */}
        {canStart && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onStartWorkout?.(day.template_id!, day.name);
            }}
            className="flex items-center gap-1 rounded-lg bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-400/20"
          >
            <Play className="size-3" />
            Start
          </button>
        )}
        {!canStart && day.template_id && (
          <ChevronRight className="size-4 text-muted-foreground/40 mt-1" />
        )}
      </div>
    </motion.div>
  );
}
