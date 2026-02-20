"use client";

import { AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { StepAccentColor } from "@/components/onboarding/step-accent-color";
import { StepFitnessGoal } from "@/components/onboarding/step-fitness-goal";
import { StepHeight } from "@/components/onboarding/step-height";
import { StepWeight } from "@/components/onboarding/step-weight";
import { StepDob } from "@/components/onboarding/step-dob";
import { StepGender } from "@/components/onboarding/step-gender";
import { toast } from "sonner";

export default function OnboardingPage() {
  const {
    currentStep,
    totalSteps,
    data,
    updateData,
    nextStep,
    prevStep,
    submit,
    loading,
    progress,
  } = useOnboarding();

  const handleNext = () => {
    // Show affirmation toast
    const affirmations = [
      "Great choice! 💙",
      "You've got this! 🔥",
      "Excellent! ⚡",
      "Perfect! ✨",
      "Amazing! 🌟",
      "Nice! 👏",
    ];
    toast.success(affirmations[Math.floor(Math.random() * affirmations.length)]);
    nextStep();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, oklch(18% 0.01 264), oklch(12% 0.01 264))",
        }}
      />

      {/* Progress bar */}
      <ProgressBar
        progress={progress}
        currentStep={currentStep}
        totalSteps={totalSteps}
      />

      {/* Step content with AnimatePresence for smooth transitions */}
      <AnimatePresence mode="wait">
        {currentStep === 0 && (
          <StepAccentColor
            key="accent-color"
            selected={data.accentColor}
            onSelect={(color) => updateData({ accentColor: color })}
            onNext={handleNext}
          />
        )}

        {currentStep === 1 && (
          <StepFitnessGoal
            key="fitness-goal"
            selected={data.fitnessGoal}
            onSelect={(goal) => updateData({ fitnessGoal: goal })}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <StepHeight
            key="height"
            heightFeet={data.heightFeet}
            heightInches={data.heightInches}
            onUpdate={(feet, inches) =>
              updateData({ heightFeet: feet, heightInches: inches })
            }
            onNext={handleNext}
          />
        )}

        {currentStep === 3 && (
          <StepWeight
            key="weight"
            currentWeight={data.currentWeight}
            goalWeight={data.goalWeight}
            showWeight={data.showWeight}
            onUpdate={(current, goal, showWeight) =>
              updateData({
                currentWeight: current,
                goalWeight: goal,
                showWeight,
              })
            }
            onNext={handleNext}
          />
        )}

        {currentStep === 4 && (
          <StepDob
            key="dob"
            dateOfBirth={data.dateOfBirth}
            onUpdate={(date) => updateData({ dateOfBirth: date })}
            onNext={handleNext}
          />
        )}

        {currentStep === 5 && (
          <StepGender
            key="gender"
            selected={data.gender}
            onSelect={(gender) => updateData({ gender })}
            onSubmit={submit}
            loading={loading}
          />
        )}
      </AnimatePresence>

      {/* Back button (except on first step) */}
      {currentStep > 0 && (
        <button
          onClick={prevStep}
          className="fixed bottom-8 left-8 p-3 rounded-full backdrop-blur-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all z-50"
          aria-label="Go back"
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
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
