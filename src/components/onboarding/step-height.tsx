"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepHeightProps {
  heightFeet: number | null;
  heightInches: number | null;
  unitPreference: "metric" | "imperial";
  onUnitChange: (preference: "metric" | "imperial") => void;
  onUpdate: (feet: number | null, inches: number | null) => void;
  onNext: () => void;
}

export function StepHeight({
  heightFeet,
  heightInches,
  unitPreference,
  onUnitChange,
  onUpdate,
  onNext,
}: StepHeightProps) {
  const unit = unitPreference === "imperial" ? "imperial" : "metric";
  const feet = Array.from({ length: 6 }, (_, i) => i + 3); // 3-8 feet
  const inches = Array.from({ length: 12 }, (_, i) => i); // 0-11 inches

  const canProceed =
    heightFeet !== null &&
    heightFeet >= 3 &&
    heightFeet <= 8 &&
    heightInches !== null &&
    heightInches >= 0 &&
    heightInches < 12;

  const heightCm =
    heightFeet !== null && heightInches !== null
      ? Math.round((heightFeet * 12 + heightInches) * 2.54 * 10) / 10
      : null;

  const handleHeightCmChange = (value: string) => {
    const parsed = Number.parseFloat(value);
    if (!value || Number.isNaN(parsed) || parsed <= 0) {
      onUpdate(null, null);
      return;
    }

    const totalInches = parsed / 2.54;
    let nextFeet = Math.floor(totalInches / 12);
    let nextInches = Math.round(totalInches - nextFeet * 12);

    if (nextInches === 12) {
      nextFeet += 1;
      nextInches = 0;
    }

    onUpdate(nextFeet, nextInches);
  };

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
            How Tall Are You? 📏
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            We&apos;ll use this to calculate your progress metrics
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border border-white/10"
        >
          <div className="mb-6 flex items-center justify-center gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => onUnitChange("metric")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                unit === "metric"
                  ? "bg-[var(--accent-500)] text-white"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              cm
            </button>
            <button
              type="button"
              onClick={() => onUnitChange("imperial")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                unit === "imperial"
                  ? "bg-[var(--accent-500)] text-white"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              ft/in
            </button>
          </div>

          {unit === "imperial" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feet" className="text-left block">
                  Feet
                </Label>
                <Select
                  value={heightFeet?.toString() || ""}
                  onValueChange={(value) =>
                    onUpdate(Number.parseInt(value, 10), heightInches)
                  }
                >
                  <SelectTrigger
                    id="feet"
                    className="h-14 text-lg font-semibold"
                  >
                    <SelectValue placeholder="0" />
                  </SelectTrigger>
                  <SelectContent>
                    {feet.map((f) => (
                      <SelectItem key={f} value={f.toString()}>
                        {f} ft
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inches" className="text-left block">
                  Inches
                </Label>
                <Select
                  value={heightInches?.toString() || ""}
                  onValueChange={(value) =>
                    onUpdate(heightFeet, Number.parseInt(value, 10))
                  }
                >
                  <SelectTrigger
                    id="inches"
                    className="h-14 text-lg font-semibold"
                  >
                    <SelectValue placeholder="0" />
                  </SelectTrigger>
                  <SelectContent>
                    {inches.map((i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i} in
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="height-cm" className="text-left block">
                Height (cm)
              </Label>
              <Input
                id="height-cm"
                type="number"
                inputMode="decimal"
                min={90}
                max={280}
                step={0.1}
                value={heightCm ?? ""}
                onChange={(e) => handleHeightCmChange(e.target.value)}
                className="h-14 text-lg font-semibold text-center"
                placeholder="e.g. 175"
              />
            </div>
          )}

          {canProceed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-lg bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20"
            >
              <p className="text-sm text-muted-foreground">
                Your height:{" "}
                <span className="font-semibold text-foreground">
                  {unit === "imperial"
                    ? `${heightFeet}'${heightInches}"`
                    : `${heightCm} cm`}
                </span>
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
