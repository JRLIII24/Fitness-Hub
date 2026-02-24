"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/stores/run-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { useSupabase } from "@/hooks/use-supabase";
import { getAllGpsPoints, deleteRunTrack } from "@/lib/run/track-store";
import { encodePolyline, decimatePoints } from "@/lib/run/polyline";
import { computeBbox } from "@/lib/run/geo";
import { computeAvgPaceSecPerKm } from "@/lib/run/pace";
import { getPrimaryZone, recommendRunTag } from "@/lib/run/zones";
import { estimateVdot } from "@/lib/run/vo2max";
import { estimateCalories } from "@/lib/run/calories";
import { computeRunSessionLoad } from "@/lib/run/fatigue-integration";
import { SplitsTable } from "@/components/run/splits-table";
import { ZoneBreakdownChart } from "@/components/run/zone-breakdown-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Footprints,
  Clock,
  TrendingUp,
  Mountain,
  Flame,
  Loader2,
} from "lucide-react";
import type { RunTag } from "@/types/run";
import { RUN_TAG_LABELS } from "@/types/run";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RunFinishPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const activeRun = useRunStore((s) => s.activeRun);
  const lifecycleState = useRunStore((s) => s.lifecycleState);
  const setSaving = useRunStore((s) => s.setSaving);
  const setCompleted = useRunStore((s) => s.setCompleted);
  const cancelRun = useRunStore((s) => s.cancelRun);
  const getMovingSeconds = useRunStore((s) => s.getMovingSeconds);

  const formatDistance = useUnitPreferenceStore((s) => s.formatDistance);
  const formatPace = useUnitPreferenceStore((s) => s.formatPace);
  const formatElevation = useUnitPreferenceStore((s) => s.formatElevation);

  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState<RunTag | null>(null);
  const [saving, setSavingState] = useState(false);
  const [userWeightKg, setUserWeightKg] = useState(75);

  useEffect(() => {
    if (lifecycleState !== "finishing") {
      if (lifecycleState === "idle" || lifecycleState === "completed") {
        router.push("/run");
      }
    }
  }, [lifecycleState, router]);

  useEffect(() => {
    const nextTag = activeRun?.tag ?? (activeRun ? recommendRunTag(activeRun.zoneSeconds) : null);
    queueMicrotask(() => {
      setTag(nextTag);
    });
  }, [activeRun]);

  useEffect(() => {
    let cancelled = false;
    async function loadWeight() {
      const { data } = await supabase
        .from("profiles")
        .select("weight_kg")
        .maybeSingle();
      if (cancelled) return;
      const weight = Number(data?.weight_kg);
      if (Number.isFinite(weight) && weight > 0) {
        setUserWeightKg(weight);
      }
    }
    loadWeight().catch(() => {
      // Keep sane fallback if profile is not available.
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSave = useCallback(async () => {
    if (!activeRun || saving) return;
    setSavingState(true);
    setSaving();

    try {
      const movingSec = getMovingSeconds();
      const totalSec = Math.floor(
        (Date.now() - activeRun.startedAt) / 1000
      );

      // Build polyline from GPS track in IDB
      const gpsPoints = await getAllGpsPoints(activeRun.id);
      const latLngs = gpsPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
      const decimated = decimatePoints(latLngs);
      const polyline =
        decimated.length > 1 ? encodePolyline(decimated) : null;
      const bbox = computeBbox(latLngs);

      const avgPace = computeAvgPaceSecPerKm(activeRun.distanceM, movingSec);
      const primaryZone = getPrimaryZone(activeRun.zoneSeconds);
      const vo2max = estimateVdot(activeRun.distanceM, movingSec / 60);
      const calories = estimateCalories(
        activeRun.zoneSeconds,
        userWeightKg,
        movingSec
      );
      const sessionLoad = computeRunSessionLoad(rpe, movingSec, primaryZone);

      const payload = {
        local_id: activeRun.id,
        name: activeRun.name,
        tag,
        notes: notes || null,
        started_at: new Date(activeRun.startedAt).toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: totalSec,
        moving_duration_seconds: movingSec,
        distance_meters: activeRun.distanceM,
        avg_pace_sec_per_km: avgPace || null,
        best_pace_sec_per_km: activeRun.bestPaceSecPerKm || null,
        elevation_gain_m: activeRun.elevationGainM || null,
        elevation_loss_m: activeRun.elevationLossM || null,
        estimated_calories: calories || null,
        session_rpe: rpe,
        estimated_vo2max: vo2max,
        session_load: sessionLoad,
        zone_breakdown: activeRun.zoneSeconds,
        primary_zone: primaryZone,
        route_polyline: polyline,
        is_treadmill: activeRun.isTreadmill,
        map_bbox: bbox,
        splits: activeRun.splits.map((s) => ({
          split_number: s.split_number,
          split_distance_meters: s.split_distance_meters,
          duration_seconds: s.duration_seconds,
          pace_sec_per_km: s.pace_sec_per_km,
          elevation_gain_m: s.elevation_gain_m,
          elevation_loss_m: s.elevation_loss_m,
          zone: s.zone,
          lat: s.lat,
          lng: s.lng,
          started_at: s.started_at,
          completed_at: s.completed_at,
        })),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const res = await fetch("/api/run/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const { run } = await res.json();
        await deleteRunTrack(activeRun.id);
        setCompleted();
        router.push(`/run/${run.id}`);
      } else {
        console.error("Failed to save run:", await res.text());
        // Still complete locally
        setCompleted();
        router.push("/run");
      }
    } catch (error) {
      console.error("Error saving run:", error);
      setCompleted();
      router.push("/run");
    }
  }, [
    activeRun,
    saving,
    tag,
    notes,
    rpe,
    userWeightKg,
    setSaving,
    setCompleted,
    getMovingSeconds,
    router,
  ]);

  const handleDiscard = () => {
    if (activeRun) {
      deleteRunTrack(activeRun.id);
    }
    cancelRun();
    fetch("/api/run/active", { method: "DELETE" }).catch(() => {});
    router.push("/run");
  };

  if (!activeRun) return null;

  const movingSec = getMovingSeconds();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 pb-20">
      <h1 className="text-xl font-bold">Run Summary</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Distance"
          value={formatDistance(activeRun.distanceM)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Duration"
          value={formatDuration(movingSec)}
        />
        <StatCard
          icon={<Footprints className="h-4 w-4" />}
          label="Avg Pace"
          value={formatPace(
            computeAvgPaceSecPerKm(activeRun.distanceM, movingSec)
          )}
        />
        <StatCard
          icon={<Mountain className="h-4 w-4" />}
          label="Elevation"
          value={formatElevation(activeRun.elevationGainM)}
        />
      </div>

      {/* Zone Breakdown */}
      <Card className="rounded-2xl border border-border/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Intensity Zones
        </h2>
        <ZoneBreakdownChart breakdown={activeRun.zoneSeconds} />
      </Card>

      {/* Splits */}
      {activeRun.splits.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Splits
          </h2>
          <SplitsTable splits={activeRun.splits} />
        </div>
      )}

      {/* RPE */}
      <Card className="rounded-2xl border border-border/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          How hard was this run? (RPE)
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={rpe}
            onChange={(e) => setRpe(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="w-8 text-center text-lg font-bold text-primary">
            {rpe}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>Easy</span>
          <span>Max Effort</span>
        </div>
      </Card>

      {/* Tag */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Run Type
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RUN_TAG_LABELS) as RunTag[]).map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tag === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-card text-muted-foreground"
              )}
            >
              {RUN_TAG_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel?"
          className="rounded-xl"
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="w-full rounded-xl"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Flame className="mr-2 h-5 w-5" />
              Save Run
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={handleDiscard}
          className="w-full text-sm text-destructive"
        >
          Discard Run
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
