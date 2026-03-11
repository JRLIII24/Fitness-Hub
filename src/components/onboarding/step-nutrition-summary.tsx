"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NutritionPlan {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  fitness_goal: "build_muscle" | "lose_weight" | "maintain" | "improve_endurance";
  rationale: string;
}

interface StepNutritionSummaryProps {
  plan: NutritionPlan;
  onUpdatePlan: (plan: NutritionPlan) => void;
  onSubmit: () => void;
  loading: boolean;
}

// ── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <>{value.toLocaleString()}</>;
}

// ── Macro ring ───────────────────────────────────────────────────────────────

function MacroRing({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const total = proteinCal + carbsCal + fatCal;

  const proteinPct = total > 0 ? (proteinCal / total) * 100 : 0;
  const carbsPct = total > 0 ? (carbsCal / total) * 100 : 0;
  const fatPct = total > 0 ? (fatCal / total) * 100 : 0;

  const R = 52;
  const CIRC = 2 * Math.PI * R;

  const proteinLen = (proteinPct / 100) * CIRC;
  const carbsLen = (carbsPct / 100) * CIRC;
  const fatLen = (fatPct / 100) * CIRC;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="65" cy="65" r={R} strokeWidth="8" fill="none" className="stroke-border/30" />
        {/* Fat (bottom layer) */}
        <circle
          cx="65"
          cy="65"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(244 114 182)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${CIRC - (proteinLen + carbsLen + fatLen)}`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        {/* Carbs (middle layer) */}
        <circle
          cx="65"
          cy="65"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(250 204 21)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${CIRC - (proteinLen + carbsLen)}`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        {/* Protein (top layer) */}
        <circle
          cx="65"
          cy="65"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${CIRC - proteinLen}`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Macros</span>
      </div>
    </div>
  );
}

// ── Goal label ───────────────────────────────────────────────────────────────

const goalLabels: Record<string, string> = {
  build_muscle: "Build Muscle",
  lose_weight: "Lose Weight",
  maintain: "Maintain Weight",
  improve_endurance: "Improve Endurance",
};

// ── Main component ───────────────────────────────────────────────────────────

export function StepNutritionSummary({
  plan,
  onUpdatePlan,
  onSubmit,
  loading,
}: StepNutritionSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    calories: plan.calories.toString(),
    protein_g: plan.protein_g.toString(),
    carbs_g: plan.carbs_g.toString(),
    fat_g: plan.fat_g.toString(),
    fiber_g: plan.fiber_g.toString(),
  });

  const handleSaveEdits = () => {
    const updated: NutritionPlan = {
      ...plan,
      calories: parseInt(editValues.calories) || plan.calories,
      protein_g: parseInt(editValues.protein_g) || plan.protein_g,
      carbs_g: parseInt(editValues.carbs_g) || plan.carbs_g,
      fat_g: parseInt(editValues.fat_g) || plan.fat_g,
      fiber_g: parseInt(editValues.fiber_g) || plan.fiber_g,
    };
    onUpdatePlan(updated);
    setIsEditing(false);
  };

  const macros = [
    { key: "protein_g", label: "Protein", value: plan.protein_g, unit: "g", color: "text-blue-400", bg: "bg-blue-400" },
    { key: "carbs_g", label: "Carbs", value: plan.carbs_g, unit: "g", color: "text-yellow-400", bg: "bg-yellow-400" },
    { key: "fat_g", label: "Fat", value: plan.fat_g, unit: "g", color: "text-pink-400", bg: "bg-pink-400" },
    { key: "fiber_g", label: "Fiber", value: plan.fiber_g, unit: "g", color: "text-green-400", bg: "bg-green-400" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
    >
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10"
          >
            <Sparkles className="h-7 w-7 text-emerald-400" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-foreground"
          >
            Your Apex Plan
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            Goal: {goalLabels[plan.fitness_goal] ?? plan.fitness_goal}
          </motion.p>
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-6 space-y-6"
        >
          {/* Calories hero */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Daily Calories
            </p>
            <p className="tabular-nums text-[48px] font-black leading-none text-foreground">
              <AnimatedNumber target={plan.calories} />
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">kcal / day</p>
          </div>

          {/* Macro ring + breakdown */}
          <div className="flex items-center gap-6">
            <MacroRing
              protein={plan.protein_g}
              carbs={plan.carbs_g}
              fat={plan.fat_g}
            />
            <div className="flex-1 space-y-2.5">
              {macros.map((macro) => (
                <div key={macro.key} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${macro.bg}`} />
                  <span className="text-[11px] text-muted-foreground flex-1">
                    {macro.label}
                  </span>
                  <span className={`text-[13px] font-bold tabular-nums ${macro.color}`}>
                    {macro.value}{macro.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rationale */}
          <div className="rounded-xl border border-border/30 bg-card/20 p-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {plan.rationale}
            </p>
          </div>

          {/* Edit mode */}
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Calories</Label>
                  <Input
                    type="number"
                    value={editValues.calories}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, calories: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Protein (g)</Label>
                  <Input
                    type="number"
                    value={editValues.protein_g}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, protein_g: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Carbs (g)</Label>
                  <Input
                    type="number"
                    value={editValues.carbs_g}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, carbs_g: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Fat (g)</Label>
                  <Input
                    type="number"
                    value={editValues.fat_g}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, fat_g: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" className="flex-1" onClick={handleSaveEdits}>
                  Save Changes
                </Button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full text-center text-[11px] text-primary/70 hover:text-primary transition-colors"
            >
              Adjust targets manually
            </button>
          )}
        </motion.div>

        {/* Complete button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <Button
            onClick={onSubmit}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={loading}
          >
            {loading ? "Setting up your profile..." : "Complete Setup"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
