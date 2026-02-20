"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyAccentColor } from "@/hooks/use-accent-color";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export interface OnboardingData {
  accentColor: string;
  fitnessGoal: "build_muscle" | "lose_weight" | "maintain" | "improve_endurance" | null;
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

const APP_THEME_STORAGE_KEY = "fithub-color-theme";
const ACCENT_STORAGE_KEY = "fithub-accent-color";

type ThemePreference = "default" | "pink" | "blue";
type AccentSelection = {
  preset: "electric-blue" | "neon-pink" | "custom";
  customHex: string | null;
  themePreference: ThemePreference;
};

function parseAccentSelection(raw: string): AccentSelection {
  if (raw === "neon-pink") {
    return {
      preset: "neon-pink",
      customHex: null,
      themePreference: "pink",
    };
  }

  if (raw === "electric-blue") {
    return {
      preset: "electric-blue",
      customHex: null,
      themePreference: "blue",
    };
  }

  const customMatch = raw.match(/^custom-(#[0-9a-fA-F]{6})$/);
  if (customMatch) {
    return {
      preset: "custom",
      customHex: customMatch[1],
      themePreference: "default",
    };
  }

  return {
    preset: "electric-blue",
    customHex: null,
    themePreference: "blue",
  };
}

function isMissingProfilesColumnError(error: unknown, columnName: string): boolean {
  const e = (error ?? {}) as { code?: string; message?: string };
  const message = (e.message ?? "").toLowerCase();
  return (
    e.code === "PGRST204" &&
    message.includes("profiles") &&
    message.includes(columnName.toLowerCase())
  );
}

function isUserMissingFromJwtError(error: unknown): boolean {
  const e = (error ?? {}) as { message?: string };
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("user from sub claim in jwt does not exist") ||
    (message.includes("sub claim") && message.includes("does not exist"))
  );
}

function setAppThemeClass(theme: ThemePreference | "custom") {
  const html = document.documentElement;
  const body = document.body;
  const classNames = ["theme-pink", "theme-blue"];

  classNames.forEach((className) => {
    html.classList.remove(className);
    body?.classList.remove(className);
  });

  if (theme === "pink" || theme === "blue") {
    const className = `theme-${theme}`;
    html.classList.add(className);
    body?.classList.add(className);
  }
}

export function useOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const totalSteps = 6;

  const ensureProfileExists = useCallback(async () => {
    const response = await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to initialize profile");
    }
  }, []);

  const recoverInvalidSession = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore sign-out failures while recovering invalid sessions.
    }

    toast.error("Your session is no longer valid. Please sign up again.");
    router.replace("/signup");
    router.refresh();
  }, [router, supabase]);

  const applyOnboardingAccentPreview = useCallback((accentValue: string) => {
    const html = document.documentElement;
    const selection = parseAccentSelection(accentValue);

    if (selection.preset === "custom" && selection.customHex) {
      // Keep data-accent deterministic for custom mode and override dynamic vars.
      html.setAttribute("data-accent", "electric-blue");
      const existingStyle = document.getElementById("custom-accent-preview");
      const style = existingStyle ?? document.createElement("style");
      style.id = "custom-accent-preview";
      style.textContent = `
        :root {
          --accent-500: ${selection.customHex};
          --accent-400: ${selection.customHex};
          --accent-600: ${selection.customHex};
        }
      `;
      if (!existingStyle) {
        document.head.appendChild(style);
      }
      return;
    }

    document.getElementById("custom-accent-preview")?.remove();
    html.setAttribute("data-accent", selection.preset);
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    async function bootstrapProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && isUserMissingFromJwtError(userError)) {
        if (!cancelled) {
          await recoverInvalidSession();
        }
        return;
      }

      if (!user || cancelled) return;

      try {
        await ensureProfileExists();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Profile bootstrap warning:", error);
        }
      }
    }

    bootstrapProfile();
    return () => {
      cancelled = true;
    };
  }, [ensureProfileExists, recoverInvalidSession, supabase]);

  useEffect(() => {
    applyOnboardingAccentPreview(data.accentColor);
  }, [applyOnboardingAccentPreview, data.accentColor]);

  // Submit onboarding data to Supabase
  const submit = async () => {
    if (!canProceed()) {
      toast.error("Please complete all fields");
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        if (isUserMissingFromJwtError(userError)) {
          await recoverInvalidSession();
          return;
        }
        console.error("Auth error:", userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }

      if (!user) {
        throw new Error("No authenticated user found. Please log in again.");
      }

      try {
        await ensureProfileExists();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Profile ensure warning during onboarding submit:", error);
        }
      }

      // Convert height to cm
      const heightCm = heightToCm(data.heightFeet!, data.heightInches!);

      const accentSelection = parseAccentSelection(data.accentColor);

      // Prepare update data
      const profileData: Record<string, unknown> = {
        id: user.id,
        fitness_goal: data.fitnessGoal,
        height_cm: heightCm,
        current_weight_kg: data.currentWeight,
        goal_weight_kg: data.goalWeight,
        date_of_birth: data.dateOfBirth?.toISOString().split("T")[0],
        gender: data.gender,
        show_weight: data.showWeight,
        onboarding_completed: true,
        theme_preference: accentSelection.themePreference,
      };

      if (accentSelection.customHex) {
        profileData.accent_color = accentSelection.customHex;
      }

      // Upsert so onboarding succeeds even if the profile row did not exist yet.
      let { error: updateError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" })
        .select("id")
        .single();

      // Handle projects where optional migrations haven't been applied yet.
      if (updateError && isMissingProfilesColumnError(updateError, "accent_color")) {
        delete profileData.accent_color;
        const retry = await supabase
          .from("profiles")
          .upsert(profileData, { onConflict: "id" })
          .select("id")
          .single();
        updateError = retry.error;
      }

      if (updateError && isMissingProfilesColumnError(updateError, "theme_preference")) {
        delete profileData.theme_preference;
        const retry = await supabase
          .from("profiles")
          .upsert(profileData, { onConflict: "id" })
          .select("id")
          .single();
        updateError = retry.error;
      }

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(
          `Failed to save profile: ${updateError.message || "Unknown error"}`
        );
      }

      const themeToApply = accentSelection.customHex
        ? ("custom" as const)
        : accentSelection.themePreference;

      setAppThemeClass(themeToApply);
      localStorage.setItem(APP_THEME_STORAGE_KEY, themeToApply);

      if (accentSelection.customHex) {
        localStorage.setItem(ACCENT_STORAGE_KEY, accentSelection.customHex);
        applyAccentColor(accentSelection.customHex);
      } else {
        localStorage.removeItem(ACCENT_STORAGE_KEY);
        applyAccentColor(null);
      }
      applyOnboardingAccentPreview(data.accentColor);

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
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to complete onboarding. Please try again.";
      toast.error(errorMessage);
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
