"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { RunMap } from "@/components/run/run-map";
import { SplitsTable } from "@/components/run/splits-table";
import { ZoneBreakdownChart } from "@/components/run/zone-breakdown-chart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Footprints,
  Mountain,
  Flame,
  Zap,
  Activity,
} from "lucide-react";
import type { RunSession, RunSplit, ZoneBreakdown, MapBbox } from "@/types/run";
import { RUN_TAG_LABELS } from "@/types/run";
import type { RunTag } from "@/types/run";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [run, setRun] = useState<RunSession | null>(null);
  const [splits, setSplits] = useState<RunSplit[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDistance = useUnitPreferenceStore((s) => s.formatDistance);
  const formatPace = useUnitPreferenceStore((s) => s.formatPace);
  const formatElevation = useUnitPreferenceStore((s) => s.formatElevation);

  useEffect(() => {
    async function fetchRun() {
      const res = await fetch(`/api/run/sessions/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRun(data.run);
        setSplits(data.splits);
      }
      setLoading(false);
    }
    fetchRun();
  }, [runId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Run not found</p>
        <Button
          variant="ghost"
          onClick={() => router.push("/run")}
          className="mt-3"
        >
          Back to Runs
        </Button>
      </div>
    );
  }

  const zoneBreakdown = (run.zone_breakdown ?? {}) as ZoneBreakdown;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/run")}
          className="h-8 w-8 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{run.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {new Date(run.started_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {run.tag && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {RUN_TAG_LABELS[run.tag as RunTag]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <RunMap
        polyline={run.route_polyline}
        bbox={run.map_bbox as MapBbox | null}
        height="240px"
        splitMarkers={splits
          .filter((s) => s.lat && s.lng)
          .map((s) => ({
            lat: s.lat!,
            lng: s.lng!,
            label: `Split ${s.split_number}`,
          }))}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Distance"
          value={formatDistance(Number(run.distance_meters) || 0)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Duration"
          value={formatDuration(run.moving_duration_seconds ?? run.duration_seconds)}
        />
        <StatCard
          icon={<Footprints className="h-4 w-4" />}
          label="Avg Pace"
          value={
            run.avg_pace_sec_per_km
              ? formatPace(Number(run.avg_pace_sec_per_km))
              : "—"
          }
        />
        <StatCard
          icon={<Mountain className="h-4 w-4" />}
          label="Elevation"
          value={
            run.elevation_gain_m
              ? formatElevation(Number(run.elevation_gain_m))
              : "—"
          }
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3">
        {run.estimated_calories != null && (
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Calories"
            value={`${run.estimated_calories}`}
            small
          />
        )}
        {run.estimated_vo2max != null && (
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Est. VO2max"
            value={`${Number(run.estimated_vo2max).toFixed(1)}`}
            small
          />
        )}
        {run.session_rpe != null && (
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="RPE"
            value={`${Number(run.session_rpe)}/10`}
            small
          />
        )}
      </div>

      {/* Zone Breakdown */}
      {Object.values(zoneBreakdown).some((v) => v > 0) && (
        <Card className="rounded-2xl border border-border/60 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Intensity Zones
          </h2>
          <ZoneBreakdownChart breakdown={zoneBreakdown} />
        </Card>
      )}

      {/* Splits */}
      {splits.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Splits
          </h2>
          <SplitsTable splits={splits} />
        </div>
      )}

      {/* Notes */}
      {run.notes && !run.notes.startsWith("run:") && (
        <Card className="rounded-2xl border border-border/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <p className="text-sm text-foreground">{run.notes}</p>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <Card className="rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={`mt-1.5 font-bold tabular-nums ${small ? "text-lg" : "text-xl"}`}
      >
        {value}
      </p>
    </Card>
  );
}
