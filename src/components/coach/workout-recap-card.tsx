"use client";

import { T } from "@/lib/coach-tokens";

interface WorkoutRecapData {
  total_volume_kg: number;
  total_sets: number;
  total_reps: number;
  duration_minutes: number;
  muscle_groups_hit: string[];
  prs_hit: Array<{ exercise: string; weight_kg: number; reps: number }>;
  coach_notes: string;
  intensity_rating: "light" | "moderate" | "hard" | "brutal";
}

const INTENSITY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  light: { label: "Light", color: T.sky },
  moderate: { label: "Moderate", color: T.volt },
  hard: { label: "Hard", color: T.amber },
  brutal: { label: "Brutal", color: T.error },
};

function StatCell({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          color: T.text1,
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 10, fontWeight: 600, color: T.text2, marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: T.text2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function WorkoutRecapCard({ data }: { data: WorkoutRecapData }) {
  const intensity = INTENSITY_CONFIG[data.intensity_rating] ?? INTENSITY_CONFIG.moderate;

  const formatVolume = (kg: number): string => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
    return String(Math.round(kg));
  };

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r20,
        background: `linear-gradient(145deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
      }}
    >
      {/* Header with intensity badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 0",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: T.volt,
          }}
        >
          Workout Recap
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            padding: "3px 10px",
            borderRadius: T.rFull,
            background: `color-mix(in oklch, ${intensity.color}, transparent 85%)`,
            border: `1px solid color-mix(in oklch, ${intensity.color}, transparent 70%)`,
            color: intensity.color,
          }}
        >
          {intensity.label}
        </span>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "flex",
          padding: "14px 12px",
          gap: 4,
        }}
      >
        <StatCell label="Volume" value={formatVolume(data.total_volume_kg)} unit="kg" />
        <StatCell label="Sets" value={data.total_sets} />
        <StatCell label="Reps" value={data.total_reps} />
        <StatCell label="Duration" value={data.duration_minutes} unit="min" />
      </div>

      <div style={{ height: 1, background: T.border1, margin: "0 14px" }} />

      {/* Muscle group pills */}
      {data.muscle_groups_hit.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap" as const,
            gap: 6,
            padding: "12px 14px",
          }}
        >
          {data.muscle_groups_hit.map((mg) => (
            <span
              key={mg}
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "capitalize" as const,
                padding: "3px 10px",
                borderRadius: T.rFull,
                background: T.glassElevated,
                border: `1px solid ${T.border2}`,
                color: T.sky,
              }}
            >
              {mg.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* PRs section */}
      {data.prs_hit.length > 0 && (
        <>
          <div style={{ height: 1, background: T.border1, margin: "0 14px" }} />
          <div style={{ padding: "10px 14px" }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: T.gold,
              }}
            >
              New PRs
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 8,
              }}
            >
              {data.prs_hit.map((pr, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12 }}>🏆</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text1,
                      flex: 1,
                    }}
                  >
                    {pr.exercise}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      fontVariantNumeric: "tabular-nums",
                      color: T.gold,
                    }}
                  >
                    {pr.weight_kg}
                    <span style={{ fontSize: 9, color: T.text2, marginLeft: 1 }}>kg</span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: T.text2,
                    }}
                  >
                    ×{pr.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Coach notes */}
      {data.coach_notes && (
        <>
          <div style={{ height: 1, background: T.border1, margin: "0 14px" }} />
          <div style={{ padding: "12px 14px" }}>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: T.text2,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              {data.coach_notes}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
