"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MuscleGroupRecovery,
  RecoveryStatus,
} from "@/lib/fatigue/muscle-group";
import {
  recoveryColor,
  recoveryBarColor,
} from "@/lib/fatigue/muscle-group";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(hours: number | null): string {
  if (hours == null) return "--";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function statusLabel(status: RecoveryStatus): string {
  switch (status) {
    case "recovered":
      return "Recovered";
    case "recovering":
      return "Recovering";
    case "fatigued":
      return "Fatigued";
    case "untrained":
      return "Untrained";
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
      <div className="flex-1">
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
      </div>
      <div className="h-3 w-8 animate-pulse rounded bg-muted/40" />
    </div>
  );
}

// ─── MuscleRecoveryCard ───────────────────────────────────────────────────────

export function MuscleRecoveryCard() {
  const [recoveries, setRecoveries] = useState<MuscleGroupRecovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/fatigue/muscle-groups");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) {
          setRecoveries(json.recoveries ?? []);
        }
      } catch {
        if (!cancelled) setError("Could not load recovery data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden glass-surface glass-highlight rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-[13px] font-bold text-foreground">
            Muscle Recovery
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            {error}
          </div>
        ) : recoveries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-4 text-center text-xs text-muted-foreground">
            No recent workout data. Complete a session to see per-muscle recovery
            status.
          </div>
        ) : (
          <div className="space-y-1">
            {recoveries.map((r) => (
              <div
                key={r.muscleGroup}
                className="flex items-center gap-3 rounded-xl border border-[var(--glass-border-light)] bg-[var(--glass-tint-light)] px-4 py-2.5"
              >
                {/* Muscle name */}
                <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {r.displayName}
                </span>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-tint-medium)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        recoveryBarColor(r.recoveryStatus),
                        r.recoveryStatus === "recovered" && "shadow-[0_0_6px_oklch(0.72_0.18_145_/_0.4)]",
                        r.recoveryStatus === "recovering" && "shadow-[0_0_6px_oklch(0.80_0.15_85_/_0.4)]",
                        r.recoveryStatus === "fatigued" && "shadow-[0_0_6px_oklch(0.65_0.22_25_/_0.4)]",
                      )}
                      style={{ width: `${r.recoveryPct}%` }}
                    />
                  </div>
                </div>

                {/* Recovery percentage */}
                <span
                  className={cn(
                    "w-9 text-right tabular-nums text-[11px] font-bold",
                    recoveryColor(r.recoveryStatus)
                  )}
                >
                  {r.recoveryPct}%
                </span>

                {/* Time since trained */}
                <div className="flex w-10 items-center justify-end gap-0.5 text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="tabular-nums text-[10px] font-medium">
                    {formatTimeSince(r.hoursSinceTrained)}
                  </span>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-1 pt-2">
              {(
                [
                  ["Fatigued", "bg-rose-400"],
                  ["Recovering", "bg-amber-400"],
                  ["Recovered", "bg-emerald-400"],
                ] as const
              ).map(([label, dot]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
