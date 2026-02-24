"use client";

import type { RunReadinessData } from "@/types/run";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { Card } from "@/components/ui/card";
import { Activity, Footprints, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreRunReadinessCardProps {
  readiness: RunReadinessData;
}

export function PreRunReadinessCard({ readiness }: PreRunReadinessCardProps) {
  const formatDistance = useUnitPreferenceStore((s) => s.formatDistance);

  const statusColor =
    readiness.recommendation === "go"
      ? "text-green-400"
      : readiness.recommendation === "easy"
        ? "text-yellow-400"
        : "text-red-400";

  const statusBg =
    readiness.recommendation === "go"
      ? "bg-green-400/10 border-green-400/30"
      : readiness.recommendation === "easy"
        ? "bg-yellow-400/10 border-yellow-400/30"
        : "bg-red-400/10 border-red-400/30";

  return (
    <Card className={cn("rounded-2xl border p-4", statusBg)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            readiness.recommendation === "go"
              ? "bg-green-400/20"
              : readiness.recommendation === "easy"
                ? "bg-yellow-400/20"
                : "bg-red-400/20"
          )}
        >
          <Activity className={cn("h-5 w-5", statusColor)} />
        </div>
        <div>
          <p className={cn("text-sm font-semibold", statusColor)}>
            {readiness.fatigueLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Fatigue Score: {readiness.fatigueScore}/100
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {readiness.fatigueGuidance}
      </p>

      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        {readiness.lastRunDaysAgo !== null && (
          <div className="flex items-center gap-1">
            <Footprints className="h-3 w-3" />
            <span>
              {readiness.lastRunDaysAgo === 0
                ? "Ran today"
                : `${readiness.lastRunDaysAgo}d since last run`}
            </span>
          </div>
        )}
        {readiness.lastLiftDaysAgo !== null && (
          <div className="flex items-center gap-1">
            <Dumbbell className="h-3 w-3" />
            <span>
              {readiness.lastLiftDaysAgo === 0
                ? "Lifted today"
                : `${readiness.lastLiftDaysAgo}d since last lift`}
            </span>
          </div>
        )}
      </div>

      {readiness.weeklyRunCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          This week: {readiness.weeklyRunCount} run
          {readiness.weeklyRunCount !== 1 ? "s" : ""} ·{" "}
          {formatDistance(readiness.weeklyRunDistanceM)}
        </p>
      )}
    </Card>
  );
}
