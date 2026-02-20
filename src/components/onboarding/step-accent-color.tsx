"use client";

import { motion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface StepAccentColorProps {
  selected: string;
  onSelect: (color: string) => void;
  onNext: () => void;
}

const accentPresets = [
  { id: "electric-blue", label: "Electric Blue", color: "oklch(70% 0.20 240)" },
  { id: "neon-pink", label: "Neon Pink", color: "oklch(70% 0.22 340)" },
];

// Convert hex to OKLCH (simplified - extracts hue from HSL)
function hexToOklch(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL to get hue
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  // Convert hue to degrees for OKLCH
  const hue = Math.round(h * 360);

  // Use fixed lightness and chroma for consistency
  return `oklch(70% 0.20 ${hue})`;
}

export function StepAccentColor({ selected, onSelect, onNext }: StepAccentColorProps) {
  const [customColor, setCustomColor] = useState("#6366f1");
  const [isCustom, setIsCustom] = useState(false);

  const handleSelect = (colorId: string) => {
    setIsCustom(false);
    onSelect(colorId);
    // Apply accent color immediately for live preview
    document.documentElement.setAttribute("data-accent", colorId);
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomColor(hex);
    const oklchColor = hexToOklch(hex);
    setIsCustom(true);
    onSelect(`custom-${hex}`);
    // Apply custom color immediately
    const style = document.createElement("style");
    style.id = "custom-accent-preview";
    const existingStyle = document.getElementById("custom-accent-preview");
    if (existingStyle) {
      existingStyle.remove();
    }
    style.textContent = `
      :root {
        --accent-500: ${oklchColor};
        --accent-400: oklch(from ${oklchColor} calc(l + 0.05) c h);
        --accent-600: oklch(from ${oklchColor} calc(l - 0.05) c h);
      }
    `;
    document.head.appendChild(style);
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

          {/* Custom Color Picker */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className={`relative p-6 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border-2 transition-all ${
              isCustom
                ? "border-[var(--accent-500)] shadow-lg shadow-[var(--accent-500)]/20"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-center gap-4">
              <label
                htmlFor="custom-color-input"
                className="w-12 h-12 rounded-full cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: customColor }}
              >
                <Palette className="absolute inset-0 m-auto h-6 w-6 text-white/80" />
                <Input
                  id="custom-color-input"
                  type="color"
                  value={customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              <div className="flex-1 text-left">
                <p className="text-lg font-semibold">Custom Color</p>
                <p className="text-sm text-muted-foreground">
                  Pick any color you like
                </p>
              </div>
              {isCustom && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-[var(--accent-500)] rounded-full p-1.5"
                >
                  <Check className="h-4 w-4 text-white" />
                </motion.div>
              )}
            </div>
          </motion.div>
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
            disabled={!selected && !isCustom}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
