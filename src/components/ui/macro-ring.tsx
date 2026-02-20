"use client";

import { useEffect, useRef, useState } from "react";
import { motionEasings, motionDurations } from "@/lib/motion";
import { PERFORMANCE_COLORS } from "@/lib/ui-tokens";

interface MacroRingProps {
  /** Current value consumed */
  value: number;
  /** Target/goal value */
  target: number;
  /** Macro type for color coding */
  macro: "protein" | "carbs" | "fat" | "fiber" | "calories";
  /** Size in pixels (default: 120) */
  size?: number;
  /** Stroke width in pixels (default: 12) */
  strokeWidth?: number;
  /** Display label inside ring */
  label?: string;
  /** Show percentage instead of raw values */
  showPercentage?: boolean;
  /** Animate on mount */
  animate?: boolean;
  /** Glow when goal hit */
  glowOnComplete?: boolean;
}

const MACRO_COLORS = {
  protein: PERFORMANCE_COLORS.protein,
  carbs: PERFORMANCE_COLORS.carbs,
  fat: PERFORMANCE_COLORS.fat,
  fiber: PERFORMANCE_COLORS.fiber,
  calories: "var(--accent)",         // User's accent color
} as const;

export function MacroRing({
  value,
  target,
  macro,
  size = 120,
  strokeWidth = 12,
  label,
  showPercentage = false,
  animate = true,
  glowOnComplete = true,
}: MacroRingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [animatedValue, setAnimatedValue] = useState(animate ? 0 : value);

  const percentage = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const color = MACRO_COLORS[macro];
  const isComplete = value >= target && target > 0;

  // Animate value on mount
  useEffect(() => {
    if (!animate) {
      setAnimatedValue(value);
      return;
    }

    const duration = motionDurations.celebration * 1000;
    const startTime = performance.now();
    const startValue = 0;

    function updateValue(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setAnimatedValue(startValue + (value - startValue) * eased);

      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    }

    requestAnimationFrame(updateValue);
  }, [value, animate]);

  // Glow animation on goal hit
  useEffect(() => {
    if (!glowOnComplete || !isComplete || !svgRef.current) return;

    const circle = svgRef.current.querySelector(".progress-circle") as SVGCircleElement;
    if (!circle) return;

    const animation = circle.animate([
      { filter: `drop-shadow(0 0 0px ${color})` },
      { filter: `drop-shadow(0 0 12px ${color})`, offset: 0.5 },
      { filter: `drop-shadow(0 0 0px ${color})` },
    ], {
      duration: 1000,
      iterations: 2,
      easing: `cubic-bezier(${motionEasings.standard.join(",")})`,
    });

    return () => animation.cancel();
  }, [isComplete, glowOnComplete, color]);

  const displayValue = showPercentage
    ? `${Math.round(percentage)}%`
    : `${Math.round(animatedValue)}`;

  const valueDigits = displayValue.replace(/\D/g, "").length;
  const valueFontSize =
    valueDigits >= 5
      ? Math.max(12, size * 0.13)
      : valueDigits >= 4
        ? Math.max(13, size * 0.155)
        : Math.max(14, size * 0.19);
  const metaFontSize = Math.max(9, size * 0.09);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          className="progress-circle transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percentage / 100) * circumference}
          style={{
            transition: `stroke-dashoffset ${motionDurations.celebration}s cubic-bezier(${motionEasings.primary.join(",")})`,
          }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: valueFontSize }}
        >
          {displayValue}
        </span>
        {label && (
          <span
            className="mt-0.5 text-muted-foreground leading-none"
            style={{ fontSize: metaFontSize }}
          >
            {label}
          </span>
        )}
        {!showPercentage && target > 0 && (
          <span
            className="text-muted-foreground tabular-nums leading-none"
            style={{ fontSize: metaFontSize }}
          >
            / {Math.round(target)}
          </span>
        )}
      </div>

      {/* Complete indicator */}
      {isComplete && (
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center animate-[scale-in_350ms_cubic-bezier(0.34,1.56,0.64,1)]">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
