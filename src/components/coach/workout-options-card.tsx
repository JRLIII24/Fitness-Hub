"use client";

import { motion } from "framer-motion";
import { Dumbbell, Clock, ChevronRight } from "lucide-react";
import { T } from "@/lib/coach-tokens";
import type {
  PresentWorkoutOptionsActionData,
  WorkoutOption,
} from "@/lib/coach/types";

const INTENSITY_CONFIG = {
  low: { label: "Low", color: T.sky, bg: `${T.sky}12`, border: `${T.sky}25` },
  moderate: {
    label: "Moderate",
    color: T.volt,
    bg: `${T.volt}12`,
    border: `${T.volt}25`,
  },
  high: {
    label: "High",
    color: T.amber,
    bg: `${T.amber}12`,
    border: `${T.amber}25`,
  },
  peak: {
    label: "Peak",
    color: T.error,
    bg: `${T.error}12`,
    border: `${T.error}25`,
  },
} as const;

const MAX_VISIBLE_EXERCISES = 5;

function OptionTile({
  option,
  onSelect,
  isLast,
}: {
  option: WorkoutOption;
  onSelect: () => void;
  isLast: boolean;
}) {
  const intensity = INTENSITY_CONFIG[option.intensity] ?? INTENSITY_CONFIG.moderate;
  const visibleExercises = option.exercises.slice(0, MAX_VISIBLE_EXERCISES);
  const remaining = option.exercises.length - MAX_VISIBLE_EXERCISES;

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        onClick={onSelect}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 14px",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Top row: option badge + intensity badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: T.rFull,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              background: T.glassElevated,
              border: `1px solid ${T.border2}`,
              color: T.text2,
            }}
          >
            {option.id}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: T.rFull,
              background: intensity.bg,
              border: `1px solid ${intensity.border}`,
              color: intensity.color,
            }}
          >
            {intensity.label}
          </span>
        </div>

        {/* Label */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.text1,
            margin: 0,
          }}
        >
          {option.label}
        </p>

        {/* Rationale */}
        <p
          style={{
            fontSize: 11,
            color: T.text2,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {option.rationale}
        </p>

        {/* Exercise pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap" as const,
            gap: 4,
            marginTop: 4,
          }}
        >
          {visibleExercises.map((ex, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: T.text2,
                background: T.glassElevated,
                border: `1px solid ${T.border1}`,
                borderRadius: 6,
                padding: "2px 6px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ex.name} {ex.sets}×{ex.reps}
            </span>
          ))}
          {remaining > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: T.text2,
                opacity: 0.6,
                padding: "2px 6px",
              }}
            >
              +{remaining} more
            </span>
          )}
        </div>

        {/* Footer: duration + select CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          <Clock size={11} style={{ color: T.text2, opacity: 0.7 }} />
          <span
            style={{
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
              color: T.text2,
            }}
          >
            ~{option.estimated_duration_min} min
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 10,
              fontWeight: 700,
              color: T.volt,
            }}
          >
            Select
            <ChevronRight size={12} style={{ color: T.volt }} />
          </span>
        </div>
      </motion.button>

      {/* Divider between options */}
      {!isLast && (
        <div
          style={{
            height: 1,
            background: T.border1,
            marginLeft: 14,
            marginRight: 14,
          }}
        />
      )}
    </>
  );
}

interface WorkoutOptionsCardProps {
  data: PresentWorkoutOptionsActionData;
  onSelectOption: (selectionText: string) => void;
}

export function WorkoutOptionsCard({
  data,
  onSelectOption,
}: WorkoutOptionsCardProps) {
  if (!data?.options || data.options.length < 3) return null;

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r12,
        background: `linear-gradient(135deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
        }}
      >
        <Dumbbell size={14} style={{ color: T.volt }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: T.volt,
          }}
        >
          Plan Options
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9,
            color: T.text2,
            opacity: 0.6,
          }}
        >
          tap to select
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.border1 }} />

      {/* Options */}
      {data.options.map((option, i) => (
        <OptionTile
          key={option.id}
          option={option}
          isLast={i === data.options.length - 1}
          onSelect={() =>
            onSelectOption(
              `I'll go with option ${option.id} — ${option.label}`
            )
          }
        />
      ))}
    </div>
  );
}
