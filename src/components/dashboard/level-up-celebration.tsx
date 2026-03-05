"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    // Stage 1: Radial burst confetti
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FFA500", "#FF6B9D", "#C471ED"],
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Show card after 300ms
    setTimeout(() => {
      setShowCard(true);
    }, 300);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:items-center sm:p-6">
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-sm"
          >
            <Card className="relative max-h-[min(92dvh,42rem)] overflow-y-auto overflow-x-clip rounded-3xl glass-surface-elevated p-6 shadow-2xl">
              {/* Animated Background Glow */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{
                  opacity: [0.35, 0.75, 0.35],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
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
                aria-label="Close level-up celebration"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Content */}
              <div className="relative text-center space-y-4">
                {/* Level Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-10 w-10 text-primary-foreground" />
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

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                    Level Up!
                  </h2>
                  <p className="mt-1 text-3xl font-black tracking-tight text-[#F0F4FF]">
                    You reached
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New level unlocked.
                  </p>
                </motion.div>

                {/* Level Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                  className="rounded-2xl glass-inner p-6"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="font-display text-7xl font-black tabular-nums text-primary">
                      {newLevel}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Level
                    </span>
                  </div>
                </motion.div>

                {/* Motivational Message */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  You&apos;re getting stronger. Keep stacking sessions.
                </motion.p>

                {/* Continue Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={onClose}
                    className="motion-press w-full rounded-xl"
                    size="lg"
                  >
                    Continue Training
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
