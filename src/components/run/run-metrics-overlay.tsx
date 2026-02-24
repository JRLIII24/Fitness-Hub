"use client";

import { useRunStore } from "@/stores/run-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RunMetricsOverlay({ className }: { className?: string }) {
  const activeRun = useRunStore((s) => s.activeRun);
  const lastTickMs = useRunStore((s) => s.lastTickMs);
  const getElapsedSeconds = useRunStore((s) => s.getElapsedSeconds);
  const formatDistance = useUnitPreferenceStore((s) => s.formatDistance);
  const formatPace = useUnitPreferenceStore((s) => s.formatPace);

  // Force re-render on tick
  void lastTickMs;

  if (!activeRun) return null;

  const elapsed = getElapsedSeconds();

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <MetricCard label="Time" value={formatTime(elapsed)} large />
      <MetricCard
        label="Distance"
        value={formatDistance(activeRun.distanceM)}
        large
      />
      <MetricCard
        label="Pace"
        value={formatPace(activeRun.currentPaceSecPerKm)}
      />
      <MetricCard
        label="Avg Pace"
        value={formatPace(activeRun.avgPaceSecPerKm)}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-bold tabular-nums",
          large ? "text-2xl" : "text-lg"
        )}
      >
        {value}
      </p>
    </div>
  );
}
