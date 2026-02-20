"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative mx-4 w-full max-w-sm"
          >
            <Card className="relative overflow-hidden border-2 border-primary/50 bg-gradient-to-br from-card via-primary/5 to-card p-6 shadow-2xl">
              {/* Animated Background Glow */}
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-pink-500/20"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 z-10"
                onClick={onClose}
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
                  className="inline-block"
                >
                  <div className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 p-4 shadow-lg">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                    Level Up!
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You've reached level {newLevel}
                  </p>
                </motion.div>

                {/* Level Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                  className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-6"
                >
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-bold tabular-nums text-primary">
                      {newLevel}
                    </span>
                    <span className="text-2xl font-semibold text-muted-foreground">
                      LVL
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
                  You're getting stronger! 💪
                </motion.p>

                {/* Continue Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={onClose}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </motion.div>
              </div>

              {/* Decorative Elements */}
              <motion.div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-yellow-400/20 blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-orange-400/20 blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5,
                }}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
