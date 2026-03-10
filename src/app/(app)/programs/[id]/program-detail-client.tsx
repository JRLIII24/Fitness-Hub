"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { WeekView } from "@/components/programs/week-view";

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

interface ProgramData {
  name: string;
  description: string;
  weeks: ProgramWeek[];
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  weeks: number;
  days_per_week: number;
  status: string;
  current_week: number | null;
  current_day: number | null;
  program_data: ProgramData;
  is_public: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function ProgramDetailClient({ program: initial }: { program: Program }) {
  const router = useRouter();
  const [program, setProgram] = useState(initial);
  const [selectedWeek, setSelectedWeek] = useState(
    program.status === "active" ? (program.current_week ?? 1) : 1,
  );
  const [starting, setStarting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const programData = program.program_data;
  const currentWeekData = programData?.weeks?.find((w) => w.week_number === selectedWeek);
  const totalDays = programData?.weeks?.reduce((sum, w) => sum + w.days.length, 0) || 0;

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/start`, { method: "POST" });
      if (res.ok) {
        router.refresh();
        // Optimistic update
        setProgram((p) => ({ ...p, status: "active", current_week: 1, current_day: 1 }));
      }
    } finally {
      setStarting(false);
    }
  }

  async function handleStatusUpdate(status: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProgram((p) => ({ ...p, status }));
      }
    } finally {
      setUpdating(false);
    }
  }

  function handleStartWorkout(templateId: string, dayName: string) {
    router.push(`/workout?template=${templateId}&name=${encodeURIComponent(dayName)}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-24 pt-4">
      {/* Back */}
      <button
        onClick={() => router.push("/programs")}
        className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Programs
      </button>

      {/* Header */}
      <div>
        <h1 className="text-[18px] font-black text-foreground">{program.name}</h1>
        {program.description && (
          <p className="mt-1 text-[12px] text-muted-foreground">{program.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
          <span>{program.goal}</span>
          <span>{program.weeks} weeks</span>
          <span>{program.days_per_week} days/wk</span>
          <span>{totalDays} total sessions</span>
        </div>
      </div>

      {/* Share toggle */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={async () => {
          const newVal = !program.is_public;
          setProgram((p) => ({ ...p, is_public: newVal }));
          await fetch(`/api/programs/${program.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_public: newVal }),
          });
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
          program.is_public
            ? "border-primary/25 bg-primary/8"
            : "border-border/40 bg-muted/20",
        )}
      >
        {program.is_public ? (
          <Globe className="size-4 shrink-0 text-primary" />
        ) : (
          <Lock className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className={cn("text-[12px] font-bold", program.is_public ? "text-primary" : "text-foreground")}>
            {program.is_public ? "Shared to Community" : "Private"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {program.is_public ? "Visible in the program marketplace" : "Only visible to you"}
          </p>
        </div>
      </motion.button>

      {/* Action buttons */}
      {program.status === "draft" && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleStart}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 py-3 text-[13px] font-bold text-emerald-400 disabled:opacity-50"
        >
          {starting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {starting ? "Creating templates..." : "Start Program"}
        </motion.button>
      )}

      {program.status === "active" && (
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleStatusUpdate("completed")}
            disabled={updating}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-400/10 border border-sky-400/20 py-2.5 text-[11px] font-bold text-sky-400 disabled:opacity-50"
          >
            <CheckCircle2 className="size-3.5" />
            Mark Complete
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleStatusUpdate("abandoned")}
            disabled={updating}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/30 border border-border/40 px-4 py-2.5 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
          >
            <XCircle className="size-3.5" />
            Abandon
          </motion.button>
        </div>
      )}

      {/* Week tabs */}
      {programData?.weeks && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {programData.weeks.map((week) => (
            <button
              key={week.week_number}
              onClick={() => setSelectedWeek(week.week_number)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors",
                selectedWeek === week.week_number
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/30",
              )}
            >
              W{week.week_number}
            </button>
          ))}
        </div>
      )}

      {/* Week detail */}
      {currentWeekData && (
        <WeekView
          week={currentWeekData}
          isCurrentWeek={program.status === "active" && selectedWeek === program.current_week}
          programStatus={program.status}
          onStartWorkout={handleStartWorkout}
        />
      )}
    </div>
  );
}
