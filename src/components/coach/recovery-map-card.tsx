"use client";

import { T } from "@/lib/coach-tokens";

interface RecoveryMapData {
  muscle_recovery: Record<string, number>;
}

function barColor(pct: number): string {
  if (pct < 30) return T.error;
  if (pct <= 60) return T.amber;
  return T.success;
}

export function RecoveryMapCard({ data }: { data: RecoveryMapData }) {
  const entries = Object.entries(data.muscle_recovery)
    .map(([muscle, pct]) => ({ muscle, pct: Math.min(Math.max(pct, 0), 100) }))
    .sort((a, b) => a.pct - b.pct);

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r16,
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
        <span style={{ fontSize: 14 }}>❤️‍🩹</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: T.sky,
          }}
        >
          Muscle Recovery
        </span>
      </div>

      <div style={{ height: 1, background: T.border1 }} />

      {/* Bars */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "12px 14px",
        }}
      >
        {entries.map(({ muscle, pct }) => (
          <div
            key={muscle}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.text2,
                width: 80,
                textTransform: "capitalize" as const,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}
            >
              {muscle.replace(/_/g, " ")}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: T.glassElevated,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 4,
                  background: barColor(pct),
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: barColor(pct),
                width: 32,
                textAlign: "right" as const,
              }}
            >
              {Math.round(pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
