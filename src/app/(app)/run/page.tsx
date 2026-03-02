"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/stores/run-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { Button } from "@/components/ui/button";
import { Footprints, Route, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { RunSession } from "@/types/run";

function formatDistanceDisplay(meters: number | null, useKm: boolean): string {
  if (!meters) return "—";
  if (useKm) {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(2)} km`
      : `${Math.round(meters)} m`;
  }
  const miles = meters / 1609.344;
  return `${miles.toFixed(2)} mi`;
}

function formatPace(secPerKm: number | null, useKm: boolean): string {
  if (!secPerKm) return "—";
  let pace = secPerKm;
  if (!useKm) pace = secPerKm * 1.60934; // convert to sec/mi
  const mins = Math.floor(pace / 60);
  const secs = Math.round(pace % 60);
  const unit = useKm ? "/km" : "/mi";
  return `${mins}:${secs.toString().padStart(2, "0")}${unit}`;
}

function formatRunDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function RunRoutePage() {
  const router = useRouter();
  const lifecycleState = useRunStore((s) => s.lifecycleState);
  const preferKm = useUnitPreferenceStore((s) => s.splitDistanceM === 1000);
  const [recentRuns, setRecentRuns] = useState<RunSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if a run is already in progress
  useEffect(() => {
    if (
      lifecycleState === "running" ||
      lifecycleState === "paused" ||
      lifecycleState === "auto_paused"
    ) {
      router.replace("/run/active");
    } else if (lifecycleState === "finishing" || lifecycleState === "saving") {
      router.replace("/run/finish");
    }
  }, [lifecycleState, router]);

  // Fetch recent completed runs for the hub
  useEffect(() => {
    const isRedirecting =
      lifecycleState === "running" ||
      lifecycleState === "paused" ||
      lifecycleState === "auto_paused" ||
      lifecycleState === "finishing" ||
      lifecycleState === "saving";
    if (isRedirecting) return;

    fetch("/api/run/sessions?limit=5")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRecentRuns(data.runs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lifecycleState]);

  // Show spinner while redirecting to active/finish page
  if (
    lifecycleState === "running" ||
    lifecycleState === "paused" ||
    lifecycleState === "auto_paused" ||
    lifecycleState === "finishing" ||
    lifecycleState === "saving"
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Route className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Run</h1>
          <p className="text-sm text-muted-foreground">
            Track your outdoor and treadmill runs
          </p>
        </div>
      </div>

      {/* Start CTA */}
      <Button
        size="lg"
        className="w-full rounded-xl text-base"
        onClick={() => router.push("/run/start")}
      >
        <Footprints className="mr-2 h-5 w-5" />
        Start a Run
      </Button>

      {/* Recent Runs */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Runs
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
            <Footprints className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No runs yet — lace up and go!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/run/${run.id}`}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{run.name}</p>
                    {run.is_treadmill && (
                      <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                        treadmill
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceDisplay(run.distance_meters, preferKm)}
                    {run.avg_pace_sec_per_km && (
                      <>
                        {" · "}
                        {formatPace(run.avg_pace_sec_per_km, preferKm)}
                      </>
                    )}
                    {" · "}
                    {formatRunDate(run.started_at)}
                  </p>
                </div>
                <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
