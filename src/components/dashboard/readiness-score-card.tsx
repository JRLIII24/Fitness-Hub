"use client";

import { useEffect, useState } from "react";
import { Activity, Dumbbell, Apple, Moon, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { READINESS_SCORE_ENABLED } from "@/lib/features";
import type { ReadinessResult, ReadinessLevel } from "@/lib/readiness/types";

// ─── Color Helpers ───────────────────────────────────────────────────────────

function levelColor(level: ReadinessLevel): string {
  switch (level) {
    case "peak":
      return "var(--status-positive)";
    case "good":
      return "var(--status-positive)";
    case "moderate":
      return "var(--status-warning)";
    case "low":
      return "var(--status-negative)";
    case "rest":
      return "var(--status-negative)";
  }
}

function levelTextClass(level: ReadinessLevel): string {
  switch (level) {
    case "peak":
    case "good":
      return "text-[var(--status-positive)]";
    case "moderate":
      return "text-[var(--status-warning)]";
    case "low":
    case "rest":
      return "text-[var(--status-negative)]";
  }
}

function levelLabel(level: ReadinessLevel): string {
  switch (level) {
    case "peak":
      return "Peak";
    case "good":
      return "Good";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    case "rest":
      return "Rest";
  }
}

function confidenceLabel(confidence: "low" | "medium" | "high"): string {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Limited data";
  }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  level,
  size = 88,
  strokeWidth = 6,
}: {
  score: number;
  level: ReadinessLevel;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = levelColor(level);

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s ease-out",
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabular-nums text-[26px] font-black leading-none text-[#F0F4FF]">
          {score}
        </span>
        <span className={cn("mt-0.5 text-[9px] font-bold uppercase tracking-widest", levelTextClass(level))}>
          {levelLabel(level)}
        </span>
      </div>
    </div>
  );
}

// ─── Domain Bar ──────────────────────────────────────────────────────────────

const DOMAIN_META: Record<string, { label: string; icon: React.ReactNode }> = {
  training: { label: "Training", icon: <Dumbbell className="h-2.5 w-2.5" /> },
  nutrition: { label: "Nutrition", icon: <Apple className="h-2.5 w-2.5" /> },
  recovery: { label: "Recovery", icon: <Moon className="h-2.5 w-2.5" /> },
  external: { label: "External", icon: <Heart className="h-2.5 w-2.5" /> },
};

function domainBarColor(value: number): string {
  if (value >= 70) return "bg-[var(--status-positive)]";
  if (value >= 40) return "bg-[var(--status-warning)]";
  return "bg-[var(--status-negative)]";
}

function DomainRow({ domain, value }: { domain: string; value: number | null }) {
  const meta = DOMAIN_META[domain];
  if (!meta || value == null) return null;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex w-[72px] shrink-0 items-center gap-1.5 text-muted-foreground">
        {meta.icon}
        <span className="text-[10px] font-semibold">{meta.label}</span>
      </div>
      <div className="flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-tint-medium)]">
          <div
            className={cn("h-full rounded-full transition-all duration-700", domainBarColor(value))}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <span className="w-7 text-right tabular-nums text-[10px] font-bold text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ReadinessSkeleton() {
  return (
    <div className="flex items-center gap-5 p-5">
      <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-muted/30" />
      <div className="flex-1 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
      </div>
    </div>
  );
}

// ─── ReadinessScoreCard ──────────────────────────────────────────────────────

export function ReadinessScoreCard() {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!READINESS_SCORE_ENABLED) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/readiness");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) {
          setReadiness(json.readiness ?? null);
        }
      } catch {
        if (!cancelled) setError("Could not load readiness data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!READINESS_SCORE_ENABLED) return null;

  return (
    <div className="overflow-hidden glass-surface shimmer-target rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg glass-icon-container">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-[13px] font-bold text-[#F0F4FF]">
            Readiness Score
          </span>
        </div>
        {readiness && (
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {confidenceLabel(readiness.confidence)}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="glass-divider" />

      {/* Content */}
      <div>
        {loading ? (
          <ReadinessSkeleton />
        ) : error ? (
          <div className="p-4">
            <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
              {error}
            </div>
          </div>
        ) : !readiness ? (
          <div className="p-4">
            <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-4 text-center text-xs text-muted-foreground">
              Complete a workout and log nutrition to see your readiness score.
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {/* Score ring + domains */}
            <div className="flex items-start gap-5">
              <ScoreRing score={readiness.readinessScore} level={readiness.level} />
              <div className="flex-1 space-y-2.5 pt-1">
                <DomainRow domain="training" value={readiness.domains.training} />
                <DomainRow domain="nutrition" value={readiness.domains.nutrition} />
                <DomainRow domain="recovery" value={readiness.domains.recovery} />
                <DomainRow domain="external" value={readiness.domains.external} />
              </div>
            </div>

            {/* Recommendation */}
            <div
              className="rounded-xl border px-3.5 py-2.5"
              style={{
                borderColor: `color-mix(in oklch, ${levelColor(readiness.level)} 30%, transparent)`,
                backgroundColor: `color-mix(in oklch, ${levelColor(readiness.level)} 10%, transparent)`,
              }}
            >
              <p className={cn("text-[11px] font-semibold leading-relaxed", levelTextClass(readiness.level))}>
                {readiness.recommendation}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
