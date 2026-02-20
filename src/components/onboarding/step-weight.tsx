"use client";

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
            Current weight and goal weight (in kg)
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border border-white/10 space-y-6"
        >
          <div className="space-y-3">
            <Label htmlFor="current-weight" className="text-left block">
              Current Weight (kg)
            </Label>
            <Input
              id="current-weight"
              type="number"
              inputMode="decimal"
              min="20"
              max="300"
              step="0.1"
              value={currentWeight || ""}
              onChange={(e) =>
                onUpdate(
                  e.target.value ? parseFloat(e.target.value) : null,
                  goalWeight,
                  showWeight
                )
              }
              className="h-14 text-lg font-semibold text-center"
              placeholder="70.0"
            />
            {currentWeight !== null && currentWeight > 0 && (
              <Slider
                value={[currentWeight]}
                onValueChange={([value]) =>
                  onUpdate(value, goalWeight, showWeight)
                }
                min={20}
                max={300}
                step={0.5}
                className="mt-4"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="goal-weight" className="text-left block">
              Goal Weight (kg)
            </Label>
            <Input
              id="goal-weight"
              type="number"
              inputMode="decimal"
              min="20"
              max="300"
              step="0.1"
              value={goalWeight || ""}
              onChange={(e) =>
                onUpdate(
                  currentWeight,
                  e.target.value ? parseFloat(e.target.value) : null,
                  showWeight
                )
              }
              className="h-14 text-lg font-semibold text-center"
              placeholder="65.0"
            />
            {goalWeight !== null && goalWeight > 0 && (
              <Slider
                value={[goalWeight]}
                onValueChange={([value]) =>
                  onUpdate(currentWeight, value, showWeight)
                }
                min={20}
                max={300}
                step={0.5}
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
            currentWeight !== null &&
            goalWeight !== null &&
            currentWeight !== goalWeight && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-lg bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20"
              >
                <p className="text-sm text-muted-foreground">
                  {currentWeight > goalWeight ? (
                    <>
                      Target: Lose{" "}
                      <span className="font-semibold text-foreground">
                        {(currentWeight - goalWeight).toFixed(1)} kg
                      </span>
                    </>
                  ) : (
                    <>
                      Target: Gain{" "}
                      <span className="font-semibold text-foreground">
                        {(goalWeight - currentWeight).toFixed(1)} kg
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
