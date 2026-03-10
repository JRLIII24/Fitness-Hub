"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Dumbbell, TrendingUp, X, Star, Zap, Ghost, Flame, Share2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WorkoutRecapCard } from "./workout-recap-card";
import type { WorkoutRecap } from "./workout-recap-card";
import { WorkoutShareCard } from "./workout-share-card";

export interface WorkoutStats {
  duration: string; // e.g., "1h 23m"
  exerciseCount: number;
  totalVolume: number;
  unitLabel: "kg" | "lbs";
  prCount: number; // number of PRs hit
  totalSets: number;
  beatGhostCount?: number; // number of exercises where user beat their ghost
  exercises: Array<{
    name: string;
    sets: Array<{
      reps: number | null;
      weight: number | null;
      completed: boolean;
      isPR: boolean;
    }>;
  }>;
}

interface WorkoutCompleteCelebrationProps {
  stats: WorkoutStats;
  onClose: () => void;
  confettiStyle?: "gold" | "regular" | "auto";
  recapData?: WorkoutRecap | null;
  recapLoading?: boolean;
  workoutName?: string;
}

export function WorkoutCompleteCelebration({
  stats,
  onClose,
  confettiStyle = "auto",
  recapData,
  recapLoading,
  workoutName,
}: WorkoutCompleteCelebrationProps) {
  const [showStats, setShowStats] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || isSharing) return;
    setIsSharing(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0)
      );

      if (!blob) {
        toast.error("Failed to generate share image");
        return;
      }

      // Try native Web Share API with files support
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({
          files: [new File([blob], "workout.png", { type: "image/png" })],
        })
      ) {
        const file = new File([blob], "fit-hub-workout.png", { type: "image/png" });
        await navigator.share({
          title: "My Workout Summary",
          text: `Just crushed a workout! ${stats.totalVolume.toLocaleString()} ${stats.unitLabel} total volume.`,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "fit-hub-workout.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Workout image saved!");
      }
    } catch (err) {
      // User cancelled share dialog — not an error
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Share failed:", err);
      toast.error("Could not share workout");
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, stats.totalVolume, stats.unitLabel]);
  const recapItems = stats.exercises
    .map((exercise) => ({
      name: exercise.name,
      completedSets: exercise.sets.filter((set) => set.completed),
    }))
    .filter((exercise) => exercise.completedSets.length > 0);
  const longRecap =
    recapItems.length > 4 || recapItems.some((exercise) => exercise.completedSets.length > 5);

  const colors =
    confettiStyle === "gold" || (confettiStyle === "auto" && stats.prCount > 0)
      ? ["#FFD700", "#FFA500", "#FBBF24", "#FDE68A"]
      : ["#4D9FFF", "#FCD34D", "#F472B6", "#34D399"];

  useEffect(() => {
    // Stage 1: Radial burst immediately
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Side cannons at 400ms
    const sideCannons = setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });
    }, 400);

    // Stage 3: Show card after 300ms
    const showCard = setTimeout(() => {
      setShowStats(true);
    }, 300);

    return () => {
      clearTimeout(sideCannons);
      clearTimeout(showCard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:items-center sm:p-6">
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-xl"
          >
            <Card className="relative max-h-[min(92dvh,48rem)] overflow-y-auto overflow-x-clip rounded-3xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-2xl sm:p-6">
              {/* Animated surface tint */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Corner glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Header */}
              <div className="relative mb-6 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 18,
                  }}
                  className="mb-3 flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-9 w-9 text-primary-foreground" />
                    {[0, 120, 240].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-full w-full"
                        animate={{ rotate: [deg, deg + 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                      >
                        <Star className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-primary" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs font-bold uppercase tracking-[0.22em] text-primary"
                >
                  Workout Complete
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="mt-1 text-3xl font-black tracking-tight"
                >
                  Session Locked In
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.46 }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Great work today. Here&apos;s your recap.
                </motion.p>
              </div>

              {/* Stats Grid */}
              <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Duration</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">{stats.duration}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Volume</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">
                    {stats.totalVolume.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground sm:text-sm">{stats.unitLabel}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Dumbbell className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Exercises</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.exerciseCount}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Sets</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.totalSets}</p>
                </motion.div>
              </div>

              {/* Workout Recap */}
              <div className="relative mt-6 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workout Recap
                </h3>
                <div
                  className={cn(
                    "space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/40 p-3",
                    longRecap ? "max-h-[min(26dvh,210px)]" : "max-h-[min(32dvh,260px)]"
                  )}
                >
                  {recapItems.map((exercise, exerciseIndex) => (
                    <motion.div
                      key={exercise.name + exerciseIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + exerciseIndex * 0.05 }}
                      className="space-y-1.5"
                    >
                      <p className="truncate text-sm font-semibold">{exercise.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.completedSets.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            className={cn(
                              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition-all",
                              set.isPR
                                ? "border-primary/40 bg-gradient-to-r from-primary/20 to-accent/20 text-primary"
                                : "border-border/70 bg-card/50 text-foreground"
                            )}
                          >
                            {set.weight != null && set.reps != null ? (
                              <>
                                {set.weight}{stats.unitLabel} × {set.reps}
                                {set.isPR && <Trophy className="inline h-3 w-3 ml-1" />}
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
                  ))}
                </div>
              </div>

              {/* AI Recap */}
              {(recapData || recapLoading) && (
                <WorkoutRecapCard recap={recapData ?? null} loading={recapLoading ?? false} />
              )}

              {/* PR Badge */}
              {stats.prCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-6 rounded-xl border border-primary/35 bg-gradient-to-r from-primary/20 to-accent/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold text-primary">
                      {stats.prCount} Personal Record{stats.prCount > 1 ? "s" : ""}!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re getting stronger! <Trophy className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Ghost Comparison Badge */}
              {stats.beatGhostCount != null && stats.beatGhostCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.0, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-4 rounded-xl border border-accent/45 bg-gradient-to-r from-accent/20 to-primary/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Ghost className="h-5 w-5 text-foreground" />
                    <span className="text-lg font-bold text-foreground">
                      Beat Your Past Self on {stats.beatGhostCount}/{stats.exerciseCount} Exercises!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re making progress! <Flame className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="relative mt-6 flex gap-3"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="motion-press rounded-xl"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  <span className="ml-2">{isSharing ? "Sharing..." : "Share"}</span>
                </Button>
                <Button
                  onClick={onClose}
                  className="motion-press flex-1 rounded-xl"
                  size="lg"
                >
                  Continue Training
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden share card — rendered off-screen for html2canvas capture */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <WorkoutShareCard ref={shareCardRef} stats={stats} workoutName={workoutName} />
      </div>
    </div>
  );
}
