"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Trash2, CalendarClock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePrimaryColor } from "@/hooks/use-primary-color";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryNav } from "@/components/history/history-nav";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SessionSet = {
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type SessionItem = {
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  workout_templates: {
    name: string;
  } | null;
  workout_sets: SessionSet[];
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HistoryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const primaryColor = usePrimaryColor();
  const { preference, unitLabel } = useUnitPreferenceStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [dateUpdating, setDateUpdating] = useState(false);
  const [dateInputValue, setDateInputValue] = useState("");
  const [targetSession, setTargetSession] = useState<SessionItem | null>(null);

  function toDatetimeLocalValue(iso: string) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toDisplayWeight(kg: number) {
    return weightToDisplay(kg, preference === "imperial", 1);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          "id,name,started_at,completed_at,duration_seconds,workout_templates(name),workout_sets(set_number,reps,weight_kg,exercises(name,muscle_group))"
        )
        .eq("status", "completed")
        .order("started_at", { ascending: false });

      if (!active) return;

      if (error) {
        setSessions([]);
      } else {
        setSessions((data as unknown as SessionItem[]) ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, SessionItem[]>();

    for (const session of sessions) {
      const key = dayKey(new Date(session.started_at));
      const existing = grouped.get(key) ?? [];
      existing.push(session);
      grouped.set(key, existing);
    }

    return grouped;
  }, [sessions]);

  const selectedKey = dayKey(selectedDay);
  const sessionsForSelectedDay = sessionsByDay.get(selectedKey) ?? [];

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart); // Sunday
    const calEnd = endOfWeek(monthEnd);       // Saturday

    const days: Date[] = [];
    let current = calStart;
    while (current <= calEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [viewMonth]);

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm("Delete this workout from history?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast.error(error.message || "Failed to delete workout");
      return;
    }

    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    toast.success("Workout deleted");
  }

  function handleOpenDateDialog(session: SessionItem) {
    setTargetSession(session);
    setDateInputValue(toDatetimeLocalValue(session.started_at));
    setDateDialogOpen(true);
  }

  async function handleSaveDateChange() {
    if (!targetSession || !dateInputValue) return;

    const nextStart = new Date(dateInputValue);
    if (Number.isNaN(nextStart.getTime())) {
      toast.error("Please choose a valid date and time");
      return;
    }

    const oldStart = new Date(targetSession.started_at);
    const oldCompleted = targetSession.completed_at
      ? new Date(targetSession.completed_at)
      : null;
    const durationMs = oldCompleted
      ? Math.max(0, oldCompleted.getTime() - oldStart.getTime())
      : null;

    const updatePayload: {
      started_at: string;
      completed_at?: string | null;
      duration_seconds?: number | null;
    } = {
      started_at: nextStart.toISOString(),
    };

    if (durationMs != null) {
      const nextCompleted = new Date(nextStart.getTime() + durationMs);
      updatePayload.completed_at = nextCompleted.toISOString();
      updatePayload.duration_seconds = Math.round(durationMs / 1000);
    }

    setDateUpdating(true);
    const { error } = await supabase
      .from("workout_sessions")
      .update(updatePayload)
      .eq("id", targetSession.id);

    setDateUpdating(false);

    if (error) {
      toast.error(error.message || "Failed to update workout date");
      return;
    }

    setSessions((prev) =>
      prev.map((session) =>
        session.id === targetSession.id
          ? {
            ...session,
            started_at: updatePayload.started_at,
            completed_at:
              updatePayload.completed_at === undefined
                ? session.completed_at
                : updatePayload.completed_at,
            duration_seconds:
              updatePayload.duration_seconds === undefined
                ? session.duration_seconds
                : updatePayload.duration_seconds,
          }
          : session
      )
    );

    setDateDialogOpen(false);
    setTargetSession(null);
    setDateInputValue("");
    toast.success("Workout date updated");
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-6 pb-28 md:px-6 lg:px-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="History"
          subtitle="Calendar + daily logs with templates, muscle groups, reps, and sets."
        />
        <HistoryNav />
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ── Custom Calendar ────────────────────────────────────────── */}
        <div className="h-fit glass-surface rounded-2xl p-4">
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <h3 className="text-[13px] font-bold text-foreground">
              {format(viewMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = dayKey(day);
              const inMonth = isSameMonth(day, viewMonth);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              const workoutCount = (sessionsByDay.get(key) ?? []).length;
              const hasWorkout = workoutCount > 0;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(day);
                    if (!isSameMonth(day, viewMonth)) {
                      setViewMonth(startOfMonth(day));
                    }
                  }}
                  className="relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-200 hover:bg-border/30"
                  style={
                    selected
                      ? {
                          backgroundColor: primaryColor,
                          color: "white",
                          boxShadow: `0 0 12px 2px ${primaryColor}44`,
                        }
                      : hasWorkout && !selected
                      ? {
                          backgroundColor: `${primaryColor}18`,
                          boxShadow: `inset 0 0 0 1.5px ${primaryColor}55`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`text-[13px] tabular-nums font-semibold leading-none ${
                      selected
                        ? "text-white"
                        : !inMonth
                        ? "text-muted-foreground/30"
                        : hasWorkout
                        ? "font-bold"
                        : "text-foreground/80"
                    }`}
                    style={
                      hasWorkout && !selected ? { color: primaryColor } : undefined
                    }
                  >
                    {format(day, "d")}
                  </span>

                  {/* Workout indicator dot */}
                  {hasWorkout && (
                    <div
                      className="mt-0.5 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: selected ? "white" : primaryColor,
                        boxShadow: selected
                          ? "0 0 4px rgba(255,255,255,0.6)"
                          : `0 0 4px ${primaryColor}66`,
                      }}
                    />
                  )}

                  {/* Today ring (when not selected) */}
                  {today && !selected && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{
                        boxShadow: `inset 0 0 0 1.5px ${primaryColor}40`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected Day Details ───────────────────────────────────── */}
        <div className="glass-surface rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-foreground">{format(selectedDay, "EEEE, MMMM d")}</h3>
          </div>
          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading history...</p> : null}

            {!loading && sessionsForSelectedDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed workouts on this day.</p>
            ) : null}

            {sessionsForSelectedDay.map((session) => {
              const muscleGroups = [...new Set(
                session.workout_sets
                  .map((set) => set.exercises?.muscle_group)
                  .filter((value): value is string => Boolean(value))
              )];

              const totalSets = session.workout_sets.length;
              const totalReps = session.workout_sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);

              const byExercise = new Map<string, SessionSet[]>();
              for (const set of session.workout_sets) {
                const key = set.exercises?.name ?? "Unknown Exercise";
                const current = byExercise.get(key) ?? [];
                current.push(set);
                byExercise.set(key, current);
              }

              return (
                <div key={session.id} className="glass-surface rounded-2xl p-5">
                  <div className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-base font-semibold text-foreground">{session.name}</h4>
                        <p className="truncate text-xs text-muted-foreground">
                          Template: {session.workout_templates?.name ?? "No template"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="glass-chip px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                            {totalSets} sets
                          </span>
                          <span className="glass-chip px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                            {totalReps} reps
                          </span>
                          <span className="max-w-[200px] truncate glass-chip px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                            {muscleGroups.length > 0 ? muscleGroups.join(", ") : "N/A"}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-9 shrink-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/history/${session.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit session
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDateDialog(session)}>
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Change date
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[...byExercise.entries()].map(([exerciseName, sets]) => (
                      <div key={exerciseName} className="glass-inner rounded-xl p-3 text-sm">
                        <p className="min-w-0 truncate font-medium text-foreground">{exerciseName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sets.map((set, i) => (
                            <span
                              key={i}
                              className="inline-flex rounded-md bg-muted/40 px-2 py-0.5 text-[11px] tabular-nums font-semibold"
                            >
                              {set.weight_kg != null ? `${toDisplayWeight(set.weight_kg)} ${unitLabel}` : "BW"} x {set.reps ?? 0}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Workout Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workout-date-time">Date and time</Label>
            <Input
              id="workout-date-time"
              type="datetime-local"
              value={dateInputValue}
              onChange={(e) => setDateInputValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDateDialogOpen(false)}
              disabled={dateUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDateChange} disabled={dateUpdating}>
              {dateUpdating ? "Saving..." : "Save Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
