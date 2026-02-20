"use client";

import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { StepAccentColor } from "@/components/onboarding/step-accent-color";
import { StepFitnessGoal } from "@/components/onboarding/step-fitness-goal";
import { StepHeight } from "@/components/onboarding/step-height";
import { StepWeight } from "@/components/onboarding/step-weight";
import { StepDob } from "@/components/onboarding/step-dob";
import { StepGender } from "@/components/onboarding/step-gender";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function isUserMissingFromJwtError(error: unknown): boolean {
  const e = (error ?? {}) as { message?: string };
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("user from sub claim in jwt does not exist") ||
    (message.includes("sub claim") && message.includes("does not exist"))
  );
}

export default function OnboardingPage() {
  const router = useRouter();
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

  useEffect(() => {
    let cancelled = false;

    async function guardCompletedOnboarding() {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError && isUserMissingFromJwtError(userError)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        toast.error("Your session expired. Please sign up again.");
        router.replace("/signup");
        router.refresh();
        return;
      }

      if (!user || cancelled) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error) return;
      if (profile?.onboarding_completed) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    guardCompletedOnboarding();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  const handleBackToSignup = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signup");
    router.refresh();
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

      {/* Back to signup (top-left, always visible) */}
      <button
        onClick={handleBackToSignup}
        className="fixed left-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-lg transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
        aria-label="Back to sign up"
        title="Sign out and return to sign up"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sign Up
      </button>

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
