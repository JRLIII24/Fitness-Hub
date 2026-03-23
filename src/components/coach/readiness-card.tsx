"use client";

import { T } from "@/lib/coach-tokens";

interface ReadinessData {
  score: number;
  level: string;
  domains?: Record<string, number>;
}

function scoreColor(score: number): string {
  if (score >= 70) return T.volt;
  if (score >= 40) return T.amber;
  return T.error;
}

function DomainBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: T.text2,
          width: 72,
          textTransform: "capitalize" as const,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: T.glassElevated,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            background: scoreColor(pct),
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: T.text1,
          width: 28,
          textAlign: "right" as const,
        }}
      >
        {Math.round(pct)}
      </span>
    </div>
  );
}

export function ReadinessCard({ data }: { data: ReadinessData }) {
  const { score, level, domains } = data;
  const color = scoreColor(score);

  const radius = 44;
  const stroke = 7;
  const size = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - pct);

  const domainEntries = domains ? Object.entries(domains) : [];

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r16,
        background: `linear-gradient(135deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Donut */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={T.glassElevated}
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Score text */}
        <text
          x={size / 2}
          y={size / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: 28,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            fill: T.text1,
          }}
        >
          {Math.round(score)}
        </text>
      </svg>

      {/* Level badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          padding: "3px 12px",
          borderRadius: T.rFull,
          background: `color-mix(in oklch, ${color}, transparent 85%)`,
          border: `1px solid color-mix(in oklch, ${color}, transparent 70%)`,
          color,
        }}
      >
        {level}
      </span>

      {/* Domain breakdown */}
      {domainEntries.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 2,
          }}
        >
          <div
            style={{
              height: 1,
              background: T.border1,
              marginBottom: 2,
            }}
          />
          {domainEntries.map(([key, val]) => (
            <DomainBar key={key} label={key} value={val} />
          ))}
        </div>
      )}
    </div>
  );
}
