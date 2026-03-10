"use client";

import { forwardRef } from "react";
import { Trophy, Clock, Dumbbell, TrendingUp, Layers } from "lucide-react";
import type { WorkoutStats } from "./workout-complete-celebration";

export interface WorkoutShareCardProps {
  stats: WorkoutStats;
  workoutName?: string;
  date?: string; // formatted date string
}

/**
 * A visually designed share card rendered off-screen and captured via html2canvas.
 * Portrait aspect ratio (~1080x1350) optimised for social media sharing.
 */
export const WorkoutShareCard = forwardRef<HTMLDivElement, WorkoutShareCardProps>(
  function WorkoutShareCard({ stats, workoutName, date }, ref) {
    // Pick the top exercises (up to 5) — those with the heaviest single-set weight
    const topExercises = stats.exercises
      .map((ex) => {
        const completedSets = ex.sets.filter((s) => s.completed);
        const bestSet = completedSets.reduce<{ weight: number | null; reps: number | null } | null>(
          (best, s) => {
            const score = (s.weight ?? 0) * (s.reps ?? 0);
            const bestScore = best ? (best.weight ?? 0) * (best.reps ?? 0) : -1;
            return score > bestScore ? s : best;
          },
          null
        );
        return { name: ex.name, bestSet, setCount: completedSets.length };
      })
      .filter((ex) => ex.bestSet && ex.setCount > 0)
      .slice(0, 5);

    const dateStr = date ?? new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          minHeight: 1350,
          padding: 72,
          display: "flex",
          flexDirection: "column",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: "linear-gradient(160deg, #0a0a0f 0%, #141420 40%, #1a1028 70%, #0f0f18 100%)",
          color: "#ffffff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow blobs — use accent colour from CSS variable via inline fallback */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "var(--primary, #6366f1)",
            opacity: 0.12,
            filter: "blur(120px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "var(--accent, #f472b6)",
            opacity: 0.10,
            filter: "blur(100px)",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div style={{ position: "relative", marginBottom: 48 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--primary, #818cf8)",
              marginBottom: 8,
            }}
          >
            Workout Complete
          </p>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {workoutName || "Workout Session"}
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "#9ca3af",
              marginTop: 12,
            }}
          >
            {dateStr}
          </p>
        </div>

        {/* Stats Grid — 2x2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 48,
            position: "relative",
          }}
        >
          <StatCell icon="clock" label="Duration" value={stats.duration} />
          <StatCell
            icon="volume"
            label="Volume"
            value={`${stats.totalVolume.toLocaleString()} ${stats.unitLabel}`}
          />
          <StatCell icon="exercises" label="Exercises" value={String(stats.exerciseCount)} />
          <StatCell icon="sets" label="Sets" value={String(stats.totalSets)} />
        </div>

        {/* PR Badge */}
        {stats.prCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "20px 24px",
              borderRadius: 20,
              border: "1px solid rgba(250, 204, 21, 0.3)",
              background: "linear-gradient(135deg, rgba(250, 204, 21, 0.12) 0%, rgba(251, 146, 60, 0.10) 100%)",
              marginBottom: 48,
              position: "relative",
            }}
          >
            <Trophy style={{ width: 28, height: 28, color: "#facc15" }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: "#facc15" }}>
              {stats.prCount} Personal Record{stats.prCount > 1 ? "s" : ""}!
            </span>
          </div>
        )}

        {/* Top Exercises */}
        {topExercises.length > 0 && (
          <div style={{ position: "relative", flex: 1 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 16,
              }}
            >
              Top Exercises
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topExercises.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 24px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 700, flex: 1, marginRight: 16 }}>
                    {ex.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
                    {ex.bestSet?.weight != null && ex.bestSet?.reps != null ? (
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {ex.bestSet.weight} {stats.unitLabel} x {ex.bestSet.reps}
                      </span>
                    ) : ex.bestSet?.reps != null ? (
                      <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {ex.bestSet.reps} reps
                      </span>
                    ) : null}
                    <span style={{ fontSize: 14, color: "#6b7280" }}>
                      {ex.setCount} set{ex.setCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Branding footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
          }}
        >
          <Dumbbell style={{ width: 22, height: 22, color: "#6b7280" }} />
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "#6b7280",
            }}
          >
            Fit-Hub
          </span>
        </div>
      </div>
    );
  }
);

/* ── Stat cell sub-component ─────────────────────────────────────────────── */

function StatCell({
  icon,
  label,
  value,
}: {
  icon: "clock" | "volume" | "exercises" | "sets";
  label: string;
  value: string;
}) {
  const iconMap = {
    clock: <Clock style={{ width: 22, height: 22, flexShrink: 0 }} />,
    volume: <TrendingUp style={{ width: 22, height: 22, flexShrink: 0 }} />,
    exercises: <Dumbbell style={{ width: 22, height: 22, flexShrink: 0 }} />,
    sets: <Layers style={{ width: 22, height: 22, flexShrink: 0 }} />,
  };

  return (
    <div
      style={{
        padding: "28px 24px",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#9ca3af",
          marginBottom: 12,
        }}
      >
        {iconMap[icon]}
        <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {label}
        </span>
      </div>
      <p
        style={{
          fontSize: 32,
          fontWeight: 900,
          margin: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </div>
  );
}
