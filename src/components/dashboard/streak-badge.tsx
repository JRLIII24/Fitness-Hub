"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface StreakBadgeProps {
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  onUseFreeze?: () => void;
  className?: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  7: "Week Warrior",
  30: "Monthly Master",
  100: "Centurion",
  365: "Year Champion",
};

const MILESTONE_COLORS: Record<number, string> = {
  7: "from-yellow-500/20 to-amber-500/20 border-yellow-400/30 text-yellow-400",
  30: "from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400",
  100: "from-purple-500/20 to-pink-500/20 border-purple-400/30 text-purple-400",
  365: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-400",
};

export function StreakBadge({
  currentStreak,
  milestonesUnlocked = [],
  freezeAvailable,
  onUseFreeze,
  className,
}: StreakBadgeProps) {
  const [showMilestoneNotification, setShowMilestoneNotification] = useState<number | null>(null);
  const [previousMilestones, setPreviousMilestones] = useState<number[]>(milestonesUnlocked);

  // Detect new milestone unlocks
  useEffect(() => {
    const newMilestones = milestonesUnlocked.filter(
      (m) => !previousMilestones.includes(m)
    );

    if (newMilestones.length > 0) {
      const latestMilestone = Math.max(...newMilestones);
      setShowMilestoneNotification(latestMilestone);

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setShowMilestoneNotification(null);
      }, 5000);

      setPreviousMilestones(milestonesUnlocked);
    }
  }, [milestonesUnlocked, previousMilestones]);

  const nextMilestone = [7, 30, 100, 365].find((m) => m > currentStreak) ?? null;
  const daysToNext = nextMilestone ? nextMilestone - currentStreak : null;

  return (
    <div className={cn("relative", className)}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4 space-y-3">
          {/* Streak Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={currentStreak > 0 ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0],
                } : {}}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Flame className="h-6 w-6 text-orange-500" />
              </motion.div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {currentStreak}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">day streak</span>
                </p>
                {daysToNext && (
                  <p className="text-xs text-muted-foreground">
                    {daysToNext} days until {MILESTONE_LABELS[nextMilestone!]}
                  </p>
                )}
              </div>
            </div>

            {/* Freeze Badge */}
            {freezeAvailable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onUseFreeze}
                className="gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                title="Use streak freeze (1x/month)"
              >
                <Snowflake className="h-3 w-3" />
                Freeze
              </Button>
            )}
          </div>

          {/* Milestones Grid */}
          {milestonesUnlocked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[7, 30, 100, 365].map((milestone) => {
                const isUnlocked = milestonesUnlocked.includes(milestone);
                return (
                  <motion.div
                    key={milestone}
                    initial={isUnlocked ? { scale: 0 } : false}
                    animate={isUnlocked ? { scale: 1 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-[10px] font-semibold transition-all",
                        isUnlocked
                          ? `bg-gradient-to-r ${MILESTONE_COLORS[milestone]}`
                          : "border-muted-foreground/30 bg-muted/20 text-muted-foreground opacity-50"
                      )}
                    >
                      {isUnlocked && <Trophy className="h-2.5 w-2.5" />}
                      {milestone}d
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Unlock Notification */}
      <AnimatePresence>
        {showMilestoneNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-10"
          >
            <Card className={cn(
              "border-2 bg-gradient-to-r shadow-lg",
              MILESTONE_COLORS[showMilestoneNotification]
            )}>
              <CardContent className="p-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <div className="text-sm font-semibold">
                  <p>{MILESTONE_LABELS[showMilestoneNotification]} Unlocked!</p>
                  <p className="text-xs opacity-80">{showMilestoneNotification}-day streak</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
