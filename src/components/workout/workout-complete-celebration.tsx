"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Dumbbell, TrendingUp, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { celebrateWorkoutComplete } from "@/lib/celebrations";
import { cn } from "@/lib/utils";

export interface WorkoutStats {
  duration: string; // e.g., "1h 23m"
  exerciseCount: number;
  totalVolume: number; // in lbs
  prCount: number; // number of PRs hit
  totalSets: number;
  beatGhostCount?: number; // number of exercises where user beat their ghost
  exercises: Array<{
    name: string;
    sets: Array<{
      reps: number | null;
      weight: number | null; // in lbs
      completed: boolean;
      isPR: boolean;
    }>;
  }>;
}

interface WorkoutCompleteCelebrationProps {
  stats: WorkoutStats;
  onClose: () => void;
}

export function WorkoutCompleteCelebration({
  stats,
  onClose,
}: WorkoutCompleteCelebrationProps) {
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    // Stage 1: Trigger confetti immediately
    celebrateWorkoutComplete(stats.prCount > 0);

    // Stage 2: Show stats card after 500ms delay
    const timer = setTimeout(() => {
      setShowStats(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [stats.prCount]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative mx-4 w-full max-w-md"
          >
            <Card className="relative overflow-hidden border-2 border-primary/50 bg-gradient-to-br from-card via-card to-card/50 p-6 shadow-2xl">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Header */}
              <div className="mb-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
                  transition={{
                    delay: 0.2,
                    scale: { type: "spring", stiffness: 260, damping: 20 },
                    rotate: { duration: 0.5, ease: "easeInOut" }
                  }}
                  className="mb-3 inline-block"
                >
                  <div className="rounded-full bg-gradient-to-br from-primary to-primary/50 p-4">
                    <Dumbbell className="h-8 w-8 text-primary-foreground" />
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold"
                >
                  Workout Complete! 🎉
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Great work today!
                </motion.p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Duration */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Duration</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{stats.duration}</p>
                </motion.div>

                {/* Total Volume */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Volume</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {stats.totalVolume.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span>
                  </p>
                </motion.div>

                {/* Exercises */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Dumbbell className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Exercises</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{stats.exerciseCount}</p>
                </motion.div>

                {/* Sets */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Sets</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{stats.totalSets}</p>
                </motion.div>
              </div>

              {/* Workout Recap */}
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workout Recap
                </h3>
                <div className="max-h-[240px] space-y-3 overflow-y-auto rounded-lg border border-border bg-secondary/50 p-3">
                  {stats.exercises.map((exercise, exerciseIndex) => {
                    const completedSets = exercise.sets.filter((s) => s.completed);
                    if (completedSets.length === 0) return null;

                    return (
                      <motion.div
                        key={exerciseIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + exerciseIndex * 0.05 }}
                        className="space-y-1.5"
                      >
                        <p className="text-sm font-semibold">{exercise.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {completedSets.map((set, setIndex) => (
                            <div
                              key={setIndex}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                                set.isPR
                                  ? "border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400"
                                  : "border-border/70 bg-card/50 text-foreground"
                              )}
                            >
                              {set.weight != null && set.reps != null ? (
                                <>
                                  {set.weight} lbs × {set.reps}
                                  {set.isPR && " 🏆"}
                                </>
                              ) : set.reps != null ? (
                                `${set.reps} reps`
                              ) : (
                                "Set completed"
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* PR Badge (if any) */}
              {stats.prCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-6 rounded-lg border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                    <span className="text-lg font-bold text-yellow-400">
                      {stats.prCount} Personal Record{stats.prCount > 1 ? "s" : ""}!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">You're getting stronger! 🏆</p>
                </motion.div>
              )}

              {/* Ghost Comparison Badge (if any) */}
              {stats.beatGhostCount != null && stats.beatGhostCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.0, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-4 rounded-lg border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">👻</span>
                    <span className="text-lg font-bold text-cyan-400">
                      Beat Your Past Self on {stats.beatGhostCount}/{stats.exerciseCount} Exercises!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">You're making progress! 🔥</p>
                </motion.div>
              )}

              {/* Close Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="mt-6"
              >
                <Button
                  onClick={onClose}
                  className="w-full"
                  size="lg"
                >
                  Continue
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
