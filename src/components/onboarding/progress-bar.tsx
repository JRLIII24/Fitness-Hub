"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  progress: number; // 0-100
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ progress, currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-white/10">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-primary">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--accent-500)] to-[var(--accent-400)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}
