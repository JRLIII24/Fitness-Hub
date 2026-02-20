"use client";

import { motion } from "framer-motion";
import { Dumbbell, Flame, Scale, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepFitnessGoalProps {
  selected: "build_muscle" | "lose_weight" | "maintain" | "endurance" | null;
  onSelect: (goal: "build_muscle" | "lose_weight" | "maintain" | "endurance") => void;
  onNext: () => void;
}

const goals = [
  {
    id: "build_muscle" as const,
    label: "Build Muscle",
    icon: Dumbbell,
    description: "Get stronger and more defined",
    emoji: "💪",
  },
  {
    id: "lose_weight" as const,
    label: "Lose Weight",
    icon: Flame,
    description: "Burn fat and get lean",
    emoji: "🔥",
  },
  {
    id: "maintain" as const,
    label: "Maintain Weight",
    icon: Scale,
    description: "Stay healthy and balanced",
    emoji: "⚖️",
  },
  {
    id: "endurance" as const,
    label: "Improve Endurance",
    icon: Footprints,
    description: "Boost stamina and cardio",
    emoji: "🏃",
  },
];

export function StepFitnessGoal({ selected, onSelect, onNext }: StepFitnessGoalProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
    >
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-foreground"
          >
            What's Your Goal? 🎯
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Choose your primary fitness objective
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {goals.map((goal, index) => {
            const Icon = goal.icon;
            return (
              <motion.button
                key={goal.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(goal.id)}
                className={`relative p-8 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border-2 transition-all ${
                  selected === goal.id
                    ? "border-[var(--accent-500)] shadow-2xl shadow-[var(--accent-500)]/30 bg-white/10"
                    : "border-white/10 hover:border-white/20 hover:bg-white/8"
                }`}
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    className={`p-4 rounded-full ${
                      selected === goal.id
                        ? "bg-[var(--accent-500)]/20"
                        : "bg-white/5"
                    }`}
                  >
                    <Icon
                      className={`h-8 w-8 ${
                        selected === goal.id
                          ? "text-[var(--accent-500)]"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xl font-semibold flex items-center gap-2 justify-center">
                      {goal.label}
                      <span className="text-2xl">{goal.emoji}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {goal.description}
                    </p>
                  </div>
                </div>

                {selected === goal.id && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute -top-3 -right-3 bg-[var(--accent-500)] text-white rounded-full p-2 shadow-lg"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!selected}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
