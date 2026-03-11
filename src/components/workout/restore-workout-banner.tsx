"use client";

import { motion } from "framer-motion";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutExercise } from "@/types/workout";

export interface WorkoutDraft {
  sessionName: string;
  startedAt: string;
  data: {
    workoutName: string;
    startedAt: string;
    templateId?: string | null;
    exercises: WorkoutExercise[];
  } | null;
}

interface RestoreWorkoutBannerProps {
  draft: WorkoutDraft;
  onRestore: (draft: WorkoutDraft) => void;
  onDiscard: () => void;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function RestoreWorkoutBanner({ draft, onRestore, onDiscard }: RestoreWorkoutBannerProps) {
  const completedSets = draft.data?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  ) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
          <History className="h-4 w-4 text-amber-400" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-amber-400">
            Unfinished Workout
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-foreground">
            {draft.sessionName}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Started {timeAgo(draft.startedAt)}
            {completedSets > 0 && ` · ${completedSets} set${completedSets !== 1 ? "s" : ""} logged`}
          </p>

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => onRestore(draft)}
              className="h-8 rounded-lg px-4 text-xs font-semibold"
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDiscard}
              className="h-8 rounded-lg px-3 text-xs text-muted-foreground"
            >
              Discard
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDiscard}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
