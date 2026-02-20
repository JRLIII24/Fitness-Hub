"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Moon, Sun, Monitor, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreference } from "@/hooks/use-unit-preference";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { useTheme } from "@/hooks/use-theme";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAccentColor } from "@/hooks/use-accent-color";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccentColorPicker } from "@/components/ui/accent-color-picker";
import { SignOutButton } from "./sign-out-button";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfileFormProps {
  profile: Profile | null;
  email: string;
  userId: string;
}

const LBS_PER_KG = 2.205;
const CM_PER_INCH = 2.54;

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(ua);
}

function kgToLbs(kg: number | null): string {
  if (kg === null || kg === undefined) return "";
  return String(Math.round(kg * LBS_PER_KG * 10) / 10);
}

function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

function cmToFeetInches(cm: number | null): { feet: string; inches: string } {
  if (cm === null || cm === undefined || Number.isNaN(cm)) {
    return { feet: "", inches: "" };
  }

  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);

  if (inches === 12) {
    return { feet: String(feet + 1), inches: "0" };
  }

  return { feet: String(feet), inches: String(inches) };
}

function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function ProfileForm({ profile, email, userId }: ProfileFormProps) {
  const { preference: hookUnitPreference, updatePreference: updateUnitPreference, loading: unitLoading } = useUnitPreference();
  const { preference: unitPreference, setPreference: setUnitPreference } = useUnitPreferenceStore();
  const { theme, setTheme } = useTheme();
  const { appTheme, setAppTheme } = useAppTheme(userId);
  const { accentColor, setAccentColor, clearAccentColor } = useAccentColor(
    appTheme === "custom",
    userId
  );
  const profileWithOnboardingFields = profile as Profile & {
    current_weight_kg?: number | null;
    goal_weight_kg?: number | null;
  };

  const initialHeight = cmToFeetInches(profile?.height_cm ?? null);
  const initialWeightKg =
    profileWithOnboardingFields.current_weight_kg ?? profile?.weight_kg ?? null;

  const [mounted, setMounted] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState((profile as unknown as { username?: string })?.username ?? "");
  const [bio, setBio] = useState((profile as unknown as { bio?: string })?.bio ?? "");
  const [isPublic, setIsPublic] = useState((profile as unknown as { is_public?: boolean })?.is_public ?? false);
  const [heightFeet, setHeightFeet] = useState(initialHeight.feet);
  const [heightInches, setHeightInches] = useState(initialHeight.inches);
  const [weightLbs, setWeightLbs] = useState(kgToLbs(initialWeightKg));
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [fitnessGoal, setFitnessGoal] = useState<string>(
    profile?.fitness_goal ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingUnit, setIsUpdatingUnit] = useState(false);

  // Sync hook preference to Zustand store
  useEffect(() => {
    if (!unitLoading && hookUnitPreference) {
      setUnitPreference(hookUnitPreference);
    }
  }, [hookUnitPreference, unitLoading, setUnitPreference]);

  useEffect(() => {
    setMounted(true);
    setIsSafari(isSafariBrowser());
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);

    const supabase = createClient();

    const parsedWeightLbs = weightLbs !== "" ? parseFloat(weightLbs) : null;
    const weightKg =
      parsedWeightLbs !== null && !Number.isNaN(parsedWeightLbs)
        ? lbsToKg(parsedWeightLbs)
        : null;

    const parsedFeet = heightFeet !== "" ? parseInt(heightFeet, 10) : null;
    const parsedInches = heightInches !== "" ? parseInt(heightInches, 10) : null;
    const hasAnyHeightInput = heightFeet !== "" || heightInches !== "";

    if (
      hasAnyHeightInput &&
      (
        parsedFeet === null ||
        parsedInches === null ||
        Number.isNaN(parsedFeet) ||
        Number.isNaN(parsedInches) ||
        parsedFeet < 0 ||
        parsedInches < 0 ||
        parsedInches > 11
      )
    ) {
      setIsSaving(false);
      toast.error("Please enter height as feet and inches (inches must be 0-11).");
      return;
    }

    const parsedHeight =
      parsedFeet !== null &&
      parsedInches !== null &&
      !Number.isNaN(parsedFeet) &&
      !Number.isNaN(parsedInches) &&
      parsedFeet >= 0 &&
      parsedInches >= 0 &&
      parsedInches < 12
        ? feetInchesToCm(parsedFeet, parsedInches)
        : null;

    const updates = {
      display_name: displayName || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
      is_public: isPublic,
      height_cm: parsedHeight,
      current_weight_kg: weightKg,
      weight_kg: weightKg,
      date_of_birth: dateOfBirth || null,
      gender: (gender as Profile["gender"]) || null,
      fitness_goal: (fitnessGoal as Profile["fitness_goal"]) || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          ...updates,
        },
        { onConflict: "id" }
      );

    setIsSaving(false);

    if (error) {
      toast.error("Failed to save profile: " + error.message);
    } else {
      toast.success("Profile updated successfully.");
    }
  }

  async function handleUnitChange(newUnit: "metric" | "imperial") {
    setIsUpdatingUnit(true);
    try {
      // Update Zustand store immediately (optimistic)
      setUnitPreference(newUnit);

      // Then update database
      await updateUnitPreference(newUnit);
      toast.success(`Units updated to ${newUnit === "metric" ? "metric (kg)" : "imperial (lbs)"}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update unit preference";
      console.error("Unit preference error:", message);
      toast.error(message);
      // Revert to previous preference if update failed
      setUnitPreference(unitPreference);
    } finally {
      setIsUpdatingUnit(false);
    }
  }

  const colorThemeOptions = (
    isSafari
      ? [
          { value: "default", label: "Default", preview: "#f4f4f5" },
          { value: "custom", label: "Custom", preview: accentColor ?? "#22c55e" },
        ]
      : [
          { value: "default", label: "Default", preview: "#f4f4f5" },
          { value: "pink", label: "Pink", preview: "#ff4f9f" },
          { value: "blue", label: "Blue", preview: "#3e8bff" },
          { value: "custom", label: "Custom", preview: accentColor ?? "#22c55e" },
        ]
  ) as { value: AppTheme; label: string; preview: string }[];

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input
                  id="username"
                  type="text"
                  placeholder="yourhandle"
                  className="pl-7"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for discovery in social search.
              </p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell others about your fitness journey…"
                rows={2}
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            {/* Public profile toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Public Profile</p>
                  <p className="text-xs text-muted-foreground">
                    Allow others to find and view your profile
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                readOnly
                disabled
                className="cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Height */}
              <div className="space-y-1.5">
                <Label htmlFor="height-feet">Height (ft)</Label>
                <Input
                  id="height-feet"
                  type="number"
                  placeholder="e.g. 5"
                  min={0}
                  max={8}
                  step={1}
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="height-inches">Height (in)</Label>
                <Input
                  id="height-inches"
                  type="number"
                  placeholder="e.g. 10"
                  min={0}
                  max={11}
                  step={1}
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                />
              </div>

              {/* Weight */}
              <div className="space-y-1.5">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="e.g. 165"
                  min={50}
                  max={1000}
                  step={0.1}
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Gender */}
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={gender}
                  onValueChange={(val) => setGender(val)}
                >
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fitness Goal */}
              <div className="space-y-1.5">
                <Label htmlFor="fitness-goal">Fitness Goal</Label>
                <Select
                  value={fitnessGoal}
                  onValueChange={(val) => setFitnessGoal(val)}
                >
                  <SelectTrigger id="fitness-goal" className="w-full">
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lose_weight">Lose Weight</SelectItem>
                    <SelectItem value="build_muscle">Build Muscle</SelectItem>
                    <SelectItem value="maintain">Maintain Weight</SelectItem>
                    <SelectItem value="improve_endurance">
                      Improve Endurance
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="unit-pref">Unit System</Label>
            <Select
              value={unitPreference}
              onValueChange={(val) => handleUnitChange(val as "metric" | "imperial")}
              disabled={isUpdatingUnit || unitLoading}
            >
              <SelectTrigger id="unit-pref" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                <SelectItem value="imperial">Imperial (lbs, inches)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for displaying weight throughout the app
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={mounted && theme === "light" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setTheme("light")}
              >
                <Sun className="size-4" />
                Light
              </Button>
              <Button
                variant={mounted && theme === "dark" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setTheme("dark")}
              >
                <Moon className="size-4" />
                Dark
              </Button>
              <Button
                variant={mounted && theme === "system" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setTheme("system")}
              >
                <Monitor className="size-4" />
                System
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose how FitHub appears in your device
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Color Theme</Label>
            <div className={`grid gap-2 ${isSafari ? "grid-cols-2" : "grid-cols-4"}`}>
              {colorThemeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAppTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors ${
                    appTheme === opt.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span
                    className="size-7 rounded-full border border-border/40"
                    style={{ background: opt.preview }}
                  />
                  <span className="font-medium text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Accent color used across buttons, badges, and highlights
            </p>
          </div>

          <AccentColorPicker
            value={accentColor}
            onChange={setAccentColor}
            onReset={clearAccentColor}
            disabled={appTheme !== "custom"}
          />
        </CardContent>
      </Card>

      {/* Account Card */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email address</span>
            <span className="text-sm font-medium">{email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator className="bg-destructive/20" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">
                Sign out of your account on this device.
              </p>
            </div>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
