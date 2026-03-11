"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ActiveProgramInfo {
  active: true;
  programId: string;
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  currentDay: number;
  totalDaysThisWeek: number;
  dayName: string;
  templateId: string | null;
  exerciseNames: string[];
}

type ProgramResponse = ActiveProgramInfo | { active: false };

interface Props {
  refreshKey?: number;
}

export function ActiveProgramCard({ refreshKey }: Props) {
  const router = useRouter();
  const [info, setInfo] = useState<ActiveProgramInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/programs/active")
      .then((r) => r.json())
      .then((data: ProgramResponse) => {
        setInfo(data.active ? data : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading || !info) return null;

  const weekProgress = ((info.currentWeek - 1) / info.totalWeeks) * 100;
  const dayLabel = `Week ${info.currentWeek} of ${info.totalWeeks} · Day ${info.currentDay} of ${info.totalDaysThisWeek}`;
  const isFirstDay = info.currentWeek === 1 && info.currentDay === 1;

  function handleStart() {
    if (!info?.templateId) {
      router.push(`/programs/${info?.programId}`);
      return;
    }
    const params = new URLSearchParams({
      template_id: info.templateId,
      name: info.dayName,
      from_program: "1",
    });
    router.push(`/workout?${params.toString()}`);
  }

  async function goBack() {
    if (!info) return;
    setBusy(true);
    try {
      const res = await fetch("/api/programs/back", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: info.programId }),
      });
      const data = await res.json() as { backed: boolean; day_name?: string; reason?: string };
      if (data.backed) {
        toast.success(`Moved back to ${data.day_name}`);
        // Re-fetch card state
        const fresh = await fetch("/api/programs/active").then((r) => r.json()) as ProgramResponse;
        setInfo(fresh.active ? fresh : null);
      } else {
        toast.error(data.reason ?? "Could not go back");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
      setConfirmBack(false);
    }
  }

  async function skipDay() {
    if (!info) return;
    setBusy(true);
    try {
      const res = await fetch("/api/programs/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: info.programId }),
      });
      const data = await res.json() as { skipped: boolean; completed?: boolean; day_name?: string; reason?: string };
      if (data.skipped) {
        if (data.completed) {
          toast.success("Program complete! All weeks finished.", { duration: 5000 });
          setInfo(null);
        } else {
          toast.success(`Skipped to ${data.day_name}`);
          const fresh = await fetch("/api/programs/active").then((r) => r.json()) as ProgramResponse;
          setInfo(fresh.active ? fresh : null);
        }
      } else {
        toast.error(data.reason ?? "Could not skip");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
      setConfirmSkip(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-4"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Active Program
                </p>
                <p className="text-[14px] font-bold leading-tight text-foreground line-clamp-1">
                  {info.programName}
                </p>
              </div>
            </div>

            {/* Day navigator */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={isFirstDay || busy}
                onClick={() => setConfirmBack(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-card/80 hover:text-foreground disabled:opacity-30"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {dayLabel}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmSkip(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-card/80 hover:text-foreground disabled:opacity-30"
                aria-label="Skip to next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Week progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${weekProgress}%` }}
            />
          </div>

          {/* Today's session + exercises */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{info.dayName}</p>
              {info.exerciseNames.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {info.exerciseNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <Dumbbell className="h-2.5 w-2.5" />
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleStart}
              disabled={busy}
              className="shrink-0 h-9 rounded-xl gap-1 px-4 font-semibold"
            >
              Start
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Go-back confirm */}
      <AlertDialog open={confirmBack} onOpenChange={setConfirmBack}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back a day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move your program back one day. Your workout history won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={goBack}>Go Back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip confirm */}
      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip {info.dayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              A template for this session will be saved so you can still do it later. Your program will advance to the next day.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={skipDay}>Skip Day</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
