"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { NutritionPlan } from "@/hooks/use-onboarding";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { StepAccentColor } from "@/components/onboarding/step-accent-color";
import { StepHeight } from "@/components/onboarding/step-height";
import { StepWeight } from "@/components/onboarding/step-weight";
import { StepDob } from "@/components/onboarding/step-dob";
import { StepGender } from "@/components/onboarding/step-gender";
import { StepActivityLevel } from "@/components/onboarding/step-activity-level";
import { StepEquipment } from "@/components/onboarding/step-equipment";
import { StepExperience } from "@/components/onboarding/step-experience";
import { StepAiCoach } from "@/components/onboarding/step-ai-coach";
import { StepNutritionSummary } from "@/components/onboarding/step-nutrition-summary";
import { AI_ONBOARDING_ENABLED } from "@/lib/features";
import { StepFitnessGoal } from "@/components/onboarding/step-fitness-goal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
    canProceed,
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
    const affirmations = [
      "Great choice!",
      "You've got this!",
      "Excellent!",
      "Perfect!",
      "Amazing!",
      "Nice!",
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

  // Compute user stats for AI coach step
  const heightCm =
    data.heightFeet !== null && data.heightInches !== null
      ? Math.round((data.heightFeet * 12 + data.heightInches) * 2.54)
      : 170;

  const age = data.dateOfBirth
    ? Math.floor(
        (Date.now() - data.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : 25;

  const userStats = {
    height_cm: heightCm,
    weight_kg: data.currentWeight ?? 70,
    goal_weight_kg: data.goalWeight ?? null,
    age,
    gender: data.gender ?? "prefer_not_to_say",
    activity_level: data.activityLevel ?? "moderately_active",
    unit_preference: data.unitPreference,
    equipment: data.equipmentAvailable ?? [],
    experience_level: data.experienceLevel ?? "beginner",
  };

  const handlePlanGenerated = (plan: NutritionPlan) => {
    updateData({
      aiNutritionPlan: plan,
      fitnessGoal: plan.fitness_goal,
    });
    nextStep();
  };

  const handleBack = () => {
    // Clear the AI plan when navigating back from or past the AI coach step
    // so it re-runs fresh when the user returns to step 8.
    if (currentStep === 8 || currentStep === 9) {
      updateData({ aiNutritionPlan: null, fitnessGoal: null });
    }
    prevStep();
  };

  // New flow (AI enabled):  0=Accent, 1=Height, 2=Weight, 3=DOB, 4=Gender,
  //                          5=Activity, 6=Equipment, 7=Experience, 8=AI Coach, 9=Summary
  // Fallback (AI disabled): Same but step 8=FitnessGoal, step 9=Submit

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

      {/* Progress bar — includes contextual back / sign-out button */}
      <ProgressBar
        progress={progress}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onBack={handleBack}
        onBackToSignup={handleBackToSignup}
      />

      <AnimatePresence mode="wait">
        {/* Step 0: Accent Color */}
        {currentStep === 0 && (
          <StepAccentColor
            key="accent-color"
            selected={data.accentColor}
            onSelect={(color) => updateData({ accentColor: color })}
            onNext={handleNext}
          />
        )}

        {/* Step 1: Height */}
        {currentStep === 1 && (
          <StepHeight
            key="height"
            heightFeet={data.heightFeet}
            heightInches={data.heightInches}
            unitPreference={data.unitPreference}
            onUnitChange={(unitPreference) => updateData({ unitPreference })}
            onUpdate={(feet, inches) =>
              updateData({ heightFeet: feet, heightInches: inches })
            }
            onNext={handleNext}
          />
        )}

        {/* Step 2: Weight */}
        {currentStep === 2 && (
          <StepWeight
            key="weight"
            currentWeight={data.currentWeight}
            goalWeight={data.goalWeight}
            unitPreference={data.unitPreference}
            onUnitChange={(unitPreference) => updateData({ unitPreference })}
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

        {/* Step 3: DOB */}
        {currentStep === 3 && (
          <StepDob
            key="dob"
            dateOfBirth={data.dateOfBirth}
            onUpdate={(date) => updateData({ dateOfBirth: date })}
            onNext={handleNext}
          />
        )}

        {/* Step 4: Gender */}
        {currentStep === 4 && (
          <StepGender
            key="gender"
            selected={data.gender}
            onSelect={(gender) => updateData({ gender })}
            onSubmit={handleNext}
            loading={false}
          />
        )}

        {/* Step 5: Activity Level */}
        {currentStep === 5 && (
          <StepActivityLevel
            key="activity-level"
            selected={data.activityLevel}
            onSelect={(level) => updateData({ activityLevel: level })}
            onNext={handleNext}
          />
        )}

        {/* Step 6: Equipment */}
        {currentStep === 6 && (
          <motion.div
            key="equipment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
          >
            <div className="max-w-md w-full space-y-8">
              <StepEquipment
                selected={data.equipmentAvailable}
                onChange={(val) => updateData({ equipmentAvailable: val })}
              />
              <Button
                onClick={handleNext}
                size="lg"
                className="w-full text-base font-semibold"
                disabled={!canProceed()}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 7: Experience */}
        {currentStep === 7 && (
          <motion.div
            key="experience"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
          >
            <div className="max-w-md w-full space-y-8">
              <StepExperience
                selected={data.experienceLevel}
                onChange={(val) => updateData({ experienceLevel: val })}
              />
              <Button
                onClick={handleNext}
                size="lg"
                className="w-full text-base font-semibold"
                disabled={!canProceed()}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 8: AI Coach (or fallback fitness goal if AI disabled) */}
        {currentStep === 8 && (
          AI_ONBOARDING_ENABLED ? (
            <StepAiCoach
              key="ai-coach"
              userStats={userStats}
              onPlanGenerated={handlePlanGenerated}
            />
          ) : (
            <StepFitnessGoal
              key="fitness-goal-fallback"
              selected={data.fitnessGoal}
              onSelect={(goal) => updateData({ fitnessGoal: goal })}
              onNext={handleNext}
            />
          )
        )}

        {/* Step 9: Nutrition Summary (AI) or Submit (fallback) */}
        {currentStep === 9 && AI_ONBOARDING_ENABLED && data.aiNutritionPlan && (
          <StepNutritionSummary
            key="nutrition-summary"
            plan={data.aiNutritionPlan}
            onUpdatePlan={(plan) => updateData({ aiNutritionPlan: plan })}
            onSubmit={submit}
            loading={loading}
          />
        )}

        {currentStep === 9 && !AI_ONBOARDING_ENABLED && (
          <motion.div
            key="submit-fallback"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
          >
            <div className="max-w-md w-full space-y-8 text-center">
              <h1 className="text-3xl font-display font-black text-[#F0F4FF]">
                All Set!
              </h1>
              <p className="text-muted-foreground">
                Ready to start your fitness journey?
              </p>
              <Button
                onClick={submit}
                size="lg"
                className="w-full text-base font-semibold"
                disabled={loading}
              >
                {loading ? "Setting up your profile..." : "Complete Setup"}
              </Button>
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
