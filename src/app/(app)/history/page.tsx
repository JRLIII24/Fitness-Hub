"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import { Pencil, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "react-day-picker/style.css";

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

export default function HistoryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
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

  const workoutDays = useMemo(() => {
    return [...sessionsByDay.keys()].map((key) => new Date(`${key}T12:00:00`));
  }, [sessionsByDay]);

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
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pt-6 pb-28 md:px-6 lg:px-10">
      <PageHeader
        title="History"
        subtitle="Calendar + daily logs with templates, muscle groups, reps, and sets."
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit max-w-3xl">
          <CardHeader>
            <CardTitle>Workout Calendar</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <DayPicker
              mode="single"
              selected={selectedDay}
              onSelect={(day) => {
                if (day) setSelectedDay(day);
              }}
              modifiers={{ workedOut: workoutDays }}
              modifiersClassNames={{ workedOut: "bg-primary/20 rounded-md font-semibold" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDay, "EEEE, MMMM d")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                <Card key={session.id} className="border-white/10 bg-card/75">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base">{session.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Template: {session.workout_templates?.name ?? "No template"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Muscle groups: {muscleGroups.length > 0 ? muscleGroups.join(", ") : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Totals: {totalSets} sets, {totalReps} reps
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/history/${session.id}/edit`)}
                        className="shrink-0"
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDateDialog(session)}
                        className="shrink-0"
                      >
                        <CalendarClock className="size-3.5 mr-1" />
                        Change Date
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSession(session.id)}
                        className="shrink-0"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[...byExercise.entries()].map(([exerciseName, sets]) => (
                      <div key={exerciseName} className="rounded-md border border-border/60 p-2 text-sm">
                        <p className="font-medium text-foreground">{exerciseName}</p>
                        <p className="text-xs text-muted-foreground">
                          {sets
                            .map((set) => `${set.weight_kg ?? 0} x ${set.reps ?? 0}`)
                            .join(" | ")}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
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
