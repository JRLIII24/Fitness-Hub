"use client";

import { useState, useEffect } from "react";
import { Loader2, Target, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SetCommitmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSetCommitment: (workouts: number, plannedDays?: string[]) => Promise<void>;
  currentCommitment?: number;
  currentPlannedDays?: string[];
}

const DAYS = [
  { key: "mon", label: "M", full: "Monday" },
  { key: "tue", label: "T", full: "Tuesday" },
  { key: "wed", label: "W", full: "Wednesday" },
  { key: "thu", label: "T", full: "Thursday" },
  { key: "fri", label: "F", full: "Friday" },
  { key: "sat", label: "S", full: "Saturday" },
  { key: "sun", label: "S", full: "Sunday" },
] as const;

export function SetCommitmentDialog({
  open,
  onClose,
  onSetCommitment,
  currentCommitment = 0,
  currentPlannedDays = [],
}: SetCommitmentDialogProps) {
  const [selectedDays, setSelectedDays] = useState<string[]>(currentPlannedDays);
  const [loading, setLoading] = useState(false);

  // Sync when dialog opens with new values
  useEffect(() => {
    if (open) {
      setSelectedDays(currentPlannedDays.length > 0 ? currentPlannedDays : []);
    }
  }, [open, currentPlannedDays]);

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  const workoutsCount = selectedDays.length;

  async function handleSubmit() {
    if (workoutsCount === 0) return;
    setLoading(true);
    await onSetCommitment(workoutsCount, selectedDays);
    setLoading(false);
  }

  const selectedDayNames = DAYS.filter((d) => selectedDays.includes(d.key)).map((d) => d.full);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 mb-1">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">Set Weekly Goal</DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Pick the days you plan to train
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Day picker grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const isSelected = selectedDays.includes(day.key);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleDay(day.key)}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl py-2.5 transition-all duration-200 active:scale-95",
                    "border text-xs font-semibold",
                    isSelected
                      ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb,0,0,0),0.15)]"
                      : "border-border/40 bg-card/30 text-muted-foreground hover:border-border/60 hover:bg-card/50"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                    {day.full.slice(0, 3)}
                  </span>
                  <span className="text-sm font-bold">{day.label}</span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary card */}
          <div className="rounded-xl border border-border/40 bg-card/30 p-3.5 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your commitment
              </span>
              <span className="tabular-nums text-xl font-black text-foreground">
                {workoutsCount}<span className="text-sm font-semibold text-muted-foreground ml-0.5">x/wk</span>
              </span>
            </div>
            {selectedDayNames.length > 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedDayNames.join(", ")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">
                Tap the days above to set your schedule
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || workoutsCount === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting...
              </>
            ) : currentCommitment > 0 ? (
              "Update Goal"
            ) : (
              "Set Goal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
