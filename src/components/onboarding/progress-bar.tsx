"use client";

import { motion } from "framer-motion";
import { ArrowLeft, LogOut } from "lucide-react";

interface ProgressBarProps {
  progress: number; // 0-100
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;         // steps 1+ → go to previous step
  onBackToSignup?: () => void; // step 0 → sign out
}

export function ProgressBar({
  progress,
  currentStep,
  totalSteps,
  onBack,
  onBackToSignup,
}: ProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-white/10">
      <div className="mx-auto max-w-2xl px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          {/* Left: contextual back button */}
          <div className="w-20 flex-shrink-0">
            {currentStep === 0 && onBackToSignup ? (
              <button
                onClick={onBackToSignup}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
                aria-label="Back to sign up"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            ) : currentStep > 0 && onBack ? (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
          </div>

          {/* Center: step counter */}
          <span className="flex-1 text-center text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </span>

          {/* Right: percentage */}
          <div className="w-20 flex-shrink-0 text-right">
            <span className="text-sm font-medium text-primary">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
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
