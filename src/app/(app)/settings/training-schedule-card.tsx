"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSupabase } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrainingScheduleCardProps {
  userId: string;
  initialDays: number[] | null;
}

// 0=Sun..6=Sat (matches JS getDay() and Postgres EXTRACT(DOW))
const DAYS = [
  { dow: 1, label: "M", full: "Monday" },
  { dow: 2, label: "T", full: "Tuesday" },
  { dow: 3, label: "W", full: "Wednesday" },
  { dow: 4, label: "T", full: "Thursday" },
  { dow: 5, label: "F", full: "Friday" },
  { dow: 6, label: "S", full: "Saturday" },
  { dow: 0, label: "S", full: "Sunday" },
] as const;

export function TrainingScheduleCard({ userId, initialDays }: TrainingScheduleCardProps) {
  const supabase = useSupabase();
  const [selected, setSelected] = useState<Set<number>>(new Set(initialDays ?? []));
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(
    async (dow: number) => {
      const next = new Set(selected);
      if (next.has(dow)) {
        next.delete(dow);
      } else {
        next.add(dow);
      }
      setSelected(next);

      setSaving(true);
      const days = Array.from(next).sort();
      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_workout_days: days.length > 0 ? days : null,
          preferred_workout_days_set_at: days.length > 0 ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      setSaving(false);
      if (error) {
        toast.error("Failed to save schedule");
        // Revert
        const reverted = new Set(selected);
        if (reverted.has(dow)) reverted.delete(dow);
        else reverted.add(dow);
        setSelected(reverted);
      }
    },
    [selected, supabase, userId]
  );

  const restDays = 7 - selected.size;

  return (
    <Card className="glass-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          Training Schedule
        </CardTitle>
        <CardDescription className="text-xs">
          Pick the days you train. Rest days won&apos;t break your streak.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 justify-between">
          {DAYS.map(({ dow, label, full }) => {
            const active = selected.has(dow);
            return (
              <motion.button
                key={dow}
                type="button"
                title={full}
                whileTap={{ scale: 0.9 }}
                onClick={() => toggle(dow)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {label}
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {selected.size === 0
            ? "No schedule set — every day counts towards your streak"
            : `${selected.size} training day${selected.size !== 1 ? "s" : ""} · ${restDays} rest day${restDays !== 1 ? "s" : ""} per week`}
          {saving && " · Saving..."}
        </p>
      </CardContent>
    </Card>
  );
}
