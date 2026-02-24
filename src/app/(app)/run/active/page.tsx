"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/stores/run-store";
import { useGpsTracking } from "@/hooks/use-gps-tracking";
import { RunMetricsOverlay } from "@/components/run/run-metrics-overlay";
import { RunControls } from "@/components/run/run-controls";
import { GpsStatusIndicator } from "@/components/run/gps-status-indicator";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";
import { AlertTriangle, MapPin } from "lucide-react";

export default function RunActivePage() {
  const router = useRouter();
  const lifecycleState = useRunStore((s) => s.lifecycleState);
  const activeRun = useRunStore((s) => s.activeRun);
  const lastTickMs = useRunStore((s) => s.lastTickMs);
  const { gpsAccuracy } = useGpsTracking();
  const formatDistance = useUnitPreferenceStore((s) => s.formatDistance);

  // Force re-render on tick
  void lastTickMs;

  // Redirect if no active run
  useEffect(() => {
    if (lifecycleState === "idle" || lifecycleState === "completed") {
      router.push("/run");
    } else if (lifecycleState === "finishing") {
      router.push("/run/finish");
    }
  }, [lifecycleState, router]);

  if (!activeRun) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">No active run</p>
      </div>
    );
  }

  const isPaused =
    lifecycleState === "paused" || lifecycleState === "auto_paused";
  const currentSplitProgress =
    activeRun.nextSplitDistanceM > 0
      ? ((activeRun.distanceM - activeRun.currentSplitStartDistanceM) /
          (activeRun.nextSplitDistanceM -
            activeRun.currentSplitStartDistanceM)) *
        100
      : 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isPaused
              ? lifecycleState === "auto_paused"
                ? "Auto-Paused"
                : "Paused"
              : "Running"}
          </p>
          <p className="text-sm font-semibold">{activeRun.name}</p>
        </div>
        <GpsStatusIndicator accuracy={gpsAccuracy} />
      </div>

      {/* Auto-pause indicator */}
      {lifecycleState === "auto_paused" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-yellow-400/10 p-3 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Auto-paused — speed too low. Start moving to resume.
          </span>
        </div>
      )}

      {/* Background tab warning */}
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>Keep this tab active for continuous GPS tracking</span>
      </div>

      {/* Metrics */}
      <RunMetricsOverlay className="mt-4" />

      {/* Split Progress */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Split {activeRun.splits.length + 1} progress
          </span>
          <span>
            {formatDistance(
              activeRun.distanceM - activeRun.currentSplitStartDistanceM
            )}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(currentSplitProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Zone indicator */}
      {activeRun.currentZone && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Current Zone</p>
          <p
            className={cn(
              "text-lg font-bold",
              activeRun.currentZone.includes("zone5")
                ? "text-red-400"
                : activeRun.currentZone.includes("zone4")
                  ? "text-orange-400"
                  : activeRun.currentZone.includes("zone3")
                    ? "text-emerald-400"
                    : activeRun.currentZone.includes("zone2")
                      ? "text-blue-400"
                      : "text-slate-400"
            )}
          >
            {activeRun.currentZone
              .replace("zone", "Z")
              .replace("_active_recovery", "")
              .replace("_aerobic", "")
              .replace("_tempo", "")
              .replace("_threshold", "")
              .replace("_anaerobic", "")}
          </p>
        </div>
      )}

      {/* Elevation */}
      {(activeRun.elevationGainM > 0 || activeRun.elevationLossM > 0) && (
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>↑ {Math.round(activeRun.elevationGainM)}m gain</span>
          <span>↓ {Math.round(activeRun.elevationLossM)}m loss</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls */}
      <RunControls />

      <div className="h-8" />
    </div>
  );
}
