"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface StepAccentColorProps {
  selected: string;
  onSelect: (color: string) => void;
  onNext: () => void;
}

const accentPresets = [
  { id: "electric-blue", label: "Electric Blue", color: "oklch(70% 0.20 240)" },
  { id: "neon-pink", label: "Neon Pink", color: "oklch(70% 0.22 340)" },
  { id: "gold", label: "Gold", color: "oklch(75% 0.16 55)" },
];

export function StepAccentColor({ selected, onSelect, onNext }: StepAccentColorProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (colorId: string) => {
    onSelect(colorId);
    // Apply accent color immediately for live preview
    document.documentElement.setAttribute("data-accent", colorId);
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
            Choose Your Vibe 🎨
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Pick an accent color that motivates you
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 gap-4"
        >
          {accentPresets.map((preset, index) => (
            <motion.button
              key={preset.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(preset.id)}
              className={`relative p-6 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border-2 transition-all ${
                selected === preset.id
                  ? "border-[var(--accent-500)] shadow-lg shadow-[var(--accent-500)]/20"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full"
                  style={{ backgroundColor: preset.color }}
                />
                <div className="flex-1 text-left">
                  <p className="text-lg font-semibold">{preset.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Your primary theme color
                  </p>
                </div>
                {selected === preset.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-[var(--accent-500)] rounded-full p-1.5"
                  >
                    <Check className="h-4 w-4 text-white" />
                  </motion.div>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!selected}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
