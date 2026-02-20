"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface StepWeightProps {
  currentWeight: number | null;
  goalWeight: number | null;
  showWeight: boolean;
  onUpdate: (
    current: number | null,
    goal: number | null,
    showWeight: boolean
  ) => void;
  onNext: () => void;
}

export function StepWeight({
  currentWeight,
  goalWeight,
  showWeight,
  onUpdate,
  onNext,
}: StepWeightProps) {
  const [unit, setUnit] = useState<"kg" | "lbs">("lbs"); // Default to lbs

  // Conversion helpers
  const kgToLbs = (kg: number) => kg * 2.20462;
  const lbsToKg = (lbs: number) => lbs / 2.20462;

  // Get display values (convert from kg to current unit if needed)
  const currentWeightDisplay =
    currentWeight !== null && unit === "lbs"
      ? kgToLbs(currentWeight)
      : currentWeight;

  const goalWeightDisplay =
    goalWeight !== null && unit === "lbs" ? kgToLbs(goalWeight) : goalWeight;

  // Get ranges based on unit
  const minWeight = unit === "lbs" ? 44 : 20; // 44 lbs ≈ 20 kg
  const maxWeight = unit === "lbs" ? 661 : 300; // 661 lbs ≈ 300 kg
  const step = unit === "lbs" ? 1 : 0.5;

  // Handle updates (convert to kg if unit is lbs)
  const handleCurrentWeightChange = (value: number | null) => {
    const kgValue = value !== null && unit === "lbs" ? lbsToKg(value) : value;
    onUpdate(kgValue, goalWeight, showWeight);
  };

  const handleGoalWeightChange = (value: number | null) => {
    const kgValue = value !== null && unit === "lbs" ? lbsToKg(value) : value;
    onUpdate(currentWeight, kgValue, showWeight);
  };

  const canProceed =
    currentWeight !== null &&
    currentWeight > 0 &&
    goalWeight !== null &&
    goalWeight > 0;

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
            Let's Set Your Targets ⚖️
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Current weight and goal weight
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border border-white/10 space-y-6"
        >
          {/* Unit Toggle */}
          <div className="flex items-center justify-center gap-2 pb-4 border-b border-white/10">
            <button
              type="button"
              onClick={() => setUnit("kg")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                unit === "kg"
                  ? "bg-[var(--accent-500)] text-white"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              kg
            </button>
            <button
              type="button"
              onClick={() => setUnit("lbs")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                unit === "lbs"
                  ? "bg-[var(--accent-500)] text-white"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              lbs
            </button>
          </div>

          <div className="space-y-3">
            <Label htmlFor="current-weight" className="text-left block">
              Current Weight ({unit})
            </Label>
            <Input
              id="current-weight"
              type="number"
              inputMode="decimal"
              min={minWeight}
              max={maxWeight}
              step={step}
              value={currentWeightDisplay !== null ? Math.round(currentWeightDisplay * 10) / 10 : ""}
              onChange={(e) =>
                handleCurrentWeightChange(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              className="h-14 text-lg font-semibold text-center"
              placeholder={unit === "lbs" ? "154.0" : "70.0"}
            />
            {currentWeightDisplay !== null && currentWeightDisplay > 0 && (
              <Slider
                value={[currentWeightDisplay]}
                onValueChange={([value]) => handleCurrentWeightChange(value)}
                min={minWeight}
                max={maxWeight}
                step={step}
                className="mt-4"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="goal-weight" className="text-left block">
              Goal Weight ({unit})
            </Label>
            <Input
              id="goal-weight"
              type="number"
              inputMode="decimal"
              min={minWeight}
              max={maxWeight}
              step={step}
              value={goalWeightDisplay !== null ? Math.round(goalWeightDisplay * 10) / 10 : ""}
              onChange={(e) =>
                handleGoalWeightChange(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              className="h-14 text-lg font-semibold text-center"
              placeholder={unit === "lbs" ? "143.0" : "65.0"}
            />
            {goalWeightDisplay !== null && goalWeightDisplay > 0 && (
              <Slider
                value={[goalWeightDisplay]}
                onValueChange={([value]) => handleGoalWeightChange(value)}
                min={minWeight}
                max={maxWeight}
                step={step}
                className="mt-4"
              />
            )}
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 text-left">
                <Label htmlFor="show-weight">Show weight publicly</Label>
                <p className="text-sm text-muted-foreground">
                  Display on your profile
                </p>
              </div>
              <Switch
                id="show-weight"
                checked={showWeight}
                onCheckedChange={(checked) =>
                  onUpdate(currentWeight, goalWeight, checked)
                }
              />
            </div>
          </div>

          {canProceed &&
            currentWeightDisplay !== null &&
            goalWeightDisplay !== null &&
            currentWeightDisplay !== goalWeightDisplay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-lg bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20"
              >
                <p className="text-sm text-muted-foreground">
                  {currentWeightDisplay > goalWeightDisplay ? (
                    <>
                      Target: Lose{" "}
                      <span className="font-semibold text-foreground">
                        {(currentWeightDisplay - goalWeightDisplay).toFixed(1)} {unit}
                      </span>
                    </>
                  ) : (
                    <>
                      Target: Gain{" "}
                      <span className="font-semibold text-foreground">
                        {(goalWeightDisplay - currentWeightDisplay).toFixed(1)} {unit}
                      </span>
                    </>
                  )}
                </p>
              </motion.div>
            )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!canProceed}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
