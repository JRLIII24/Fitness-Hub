"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export interface OnboardingData {
  accentColor: string;
  fitnessGoal: "build_muscle" | "lose_weight" | "maintain" | "endurance" | null;
  heightFeet: number | null;
  heightInches: number | null;
  currentWeight: number | null;
  goalWeight: number | null;
  dateOfBirth: Date | null;
  gender: "male" | "female" | "prefer_not_to_say" | null;
  showWeight: boolean;
}

const initialData: OnboardingData = {
  accentColor: "electric-blue",
  fitnessGoal: null,
  heightFeet: null,
  heightInches: null,
  currentWeight: null,
  goalWeight: null,
  dateOfBirth: null,
  gender: null,
  showWeight: true,
};

export function useOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const totalSteps = 6;

  // Update data for current step
  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  // Navigate to next step
  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Validate current step
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // Accent color
        return !!data.accentColor;
      case 1: // Fitness goal
        return !!data.fitnessGoal;
      case 2: // Height
        return (
          data.heightFeet !== null &&
          data.heightFeet >= 3 &&
          data.heightFeet <= 8 &&
          data.heightInches !== null &&
          data.heightInches >= 0 &&
          data.heightInches < 12
        );
      case 3: // Weight
        return (
          data.currentWeight !== null &&
          data.currentWeight > 0 &&
          data.goalWeight !== null &&
          data.goalWeight > 0
        );
      case 4: // Date of birth
        if (!data.dateOfBirth) return false;
        const age = new Date().getFullYear() - data.dateOfBirth.getFullYear();
        return age >= 13 && age <= 120;
      case 5: // Gender
        return !!data.gender;
      default:
        return false;
    }
  };

  // Convert feet + inches to centimeters
  const heightToCm = (feet: number, inches: number): number => {
    const totalInches = feet * 12 + inches;
    return Number((totalInches * 2.54).toFixed(2));
  };

  // Submit onboarding data to Supabase
  const submit = async () => {
    if (!canProceed()) {
      toast.error("Please complete all fields");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No authenticated user found");
      }

      // Convert height to cm
      const heightCm = heightToCm(data.heightFeet!, data.heightInches!);

      // Update profile with onboarding data
      const { error } = await supabase
        .from("profiles")
        .update({
          accent_color: data.accentColor,
          fitness_goal: data.fitnessGoal,
          height_cm: heightCm,
          current_weight_kg: data.currentWeight,
          goal_weight_kg: data.goalWeight,
          date_of_birth: data.dateOfBirth?.toISOString().split("T")[0],
          gender: data.gender,
          show_weight: data.showWeight,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Apply accent color to HTML element
      document.documentElement.setAttribute("data-accent", data.accentColor);

      // Trigger confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#3b82f6", "#ec4899", "#f59e0b", "#10b981"],
      });

      toast.success("Welcome to Fit-Hub! 🎉");

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Onboarding submission error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to complete onboarding"
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStep,
    totalSteps,
    data,
    updateData,
    nextStep,
    prevStep,
    canProceed,
    submit,
    loading,
    progress: ((currentStep + 1) / totalSteps) * 100,
  };
}
