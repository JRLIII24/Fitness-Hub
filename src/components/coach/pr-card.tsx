"use client";

import { T } from "@/lib/coach-tokens";

interface PREntry {
  exercise: string;
  weight_kg: number;
  reps: number;
  date?: string;
}

interface PRData {
  prs: PREntry[];
}

export function PRCard({ data }: { data: PRData }) {
  if (!data.prs || data.prs.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r16,
        background: `linear-gradient(135deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        borderTop: `2px solid ${T.gold}`,
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
        <span style={{ fontSize: 13 }}>🏆</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: T.gold,
          }}
        >
          Personal Records
        </span>
      </div>

      <div style={{ height: 1, background: T.border1 }} />

      {/* PR rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "6px 0",
        }}
      >
        {data.prs.map((pr, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderBottom:
                i < data.prs.length - 1 ? `1px solid ${T.border1}` : "none",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.text1,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}
            >
              {pr.exercise}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
                color: T.gold,
              }}
            >
              {pr.weight_kg}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.text2,
                  marginLeft: 1,
                }}
              >
                kg
              </span>
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: T.text2,
              }}
            >
              ×{pr.reps}
            </span>
            {pr.date && (
              <span
                style={{
                  fontSize: 10,
                  color: T.text2,
                  opacity: 0.6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pr.date}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
