"use client";

import { motion } from "framer-motion";
import { Activity, Sofa, Footprints, Dumbbell, Flame, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";

interface StepActivityLevelProps {
  selected: ActivityLevel | null;
  onSelect: (level: ActivityLevel) => void;
  onNext: () => void;
}

const levels: { id: ActivityLevel; label: string; description: string; icon: LucideIcon }[] = [
  {
    id: "sedentary",
    label: "Sedentary",
    description: "Office job, little to no exercise",
    icon: Sofa,
  },
  {
    id: "lightly_active",
    label: "Lightly Active",
    description: "Light exercise 1-3 days/week",
    icon: Footprints,
  },
  {
    id: "moderately_active",
    label: "Moderately Active",
    description: "Moderate exercise 3-5 days/week",
    icon: Activity,
  },
  {
    id: "very_active",
    label: "Very Active",
    description: "Hard exercise 6-7 days/week",
    icon: Dumbbell,
  },
  {
    id: "extra_active",
    label: "Extra Active",
    description: "Athlete or physical job + training",
    icon: Flame,
  },
];

export function StepActivityLevel({
  selected,
  onSelect,
  onNext,
}: StepActivityLevelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
    >
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-foreground"
          >
            How Active Are You? <Activity className="inline h-8 w-8 ml-1" />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            This helps us calculate your daily energy needs
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 gap-3"
        >
          {levels.map((level, index) => (
            <motion.button
              key={level.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.08 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(level.id)}
              className={`relative p-5 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border-2 transition-all text-left ${
                selected === level.id
                  ? "border-[var(--accent-500)] shadow-lg shadow-[var(--accent-500)]/20 bg-white/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <level.icon className="h-6 w-6 shrink-0 text-[var(--accent-500)]" />
                <div className="flex-1">
                  <p className="text-base font-semibold">{level.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {level.description}
                  </p>
                </div>
                {selected === level.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-[var(--accent-500)] rounded-full p-1"
                  >
                    <svg
                      className="h-4 w-4 text-white"
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
              </div>
            </motion.button>
          ))}
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
