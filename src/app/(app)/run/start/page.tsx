"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/stores/run-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { PreRunReadinessCard } from "@/components/run/pre-run-readiness-card";
import { GpsStatusIndicator } from "@/components/run/gps-status-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Footprints, Navigation, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunReadinessData, RunTag } from "@/types/run";
import { RUN_TAG_LABELS } from "@/types/run";
import { toast } from "sonner";

const TAG_OPTIONS: RunTag[] = [
  "easy",
  "conditioning",
  "tempo",
  "hiit",
  "speed_work",
  "recovery",
  "long_run",
  "game_prep",
];

export default function RunStartPage() {
  const router = useRouter();
  const [name, setName] = useState("Morning Run");
  const [tag, setTag] = useState<RunTag | null>(null);
  const [isTreadmill, setIsTreadmill] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsAcquiring, setGpsAcquiring] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<RunReadinessData | null>(null);

  const initRun = useRunStore((s) => s.initRun);
  const startTracking = useRunStore((s) => s.startTracking);
  const splitDistanceM = useUnitPreferenceStore((s) => s.splitDistanceM);

  // Fetch readiness data
  useEffect(() => {
    async function fetchReadiness() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/run/readiness?timezone=${tz}`);
        if (res.ok) {
          const data = await res.json();
          setReadiness(data.readiness);
        }
      } catch {
        // Non-critical
      }
    }
    fetchReadiness();
  }, []);

  // Acquire GPS on mount
  useEffect(() => {
    if (isTreadmill) return;

    queueMicrotask(() => {
      setGpsAcquiring(true);
      setGpsError(null);
    });
    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        setGpsAcquiring(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Location permission denied");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError("Location unavailable");
        } else if (error.code === error.TIMEOUT) {
          setGpsError("GPS timed out");
        } else {
          setGpsError("GPS error");
        }
        setGpsAcquiring(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => {
      if (watchId !== undefined) navigator.geolocation?.clearWatch(watchId);
    };
  }, [isTreadmill]);

  const handleStart = useCallback(async () => {
    const runId = initRun(name, tag, isTreadmill, splitDistanceM);
    startTracking();
    router.push("/run/active");

    const res = await fetch("/api/run/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_session_id: runId,
        session_name: name,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      await useRunStore.getState().cancelRun();
      router.replace("/run/start");
      if (res?.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Another active session is already running.");
      } else {
        toast.error("Failed to start run session.");
      }
      return;
    }
  }, [name, tag, isTreadmill, splitDistanceM, initRun, startTracking, router]);

  const gpsReady = isTreadmill || (gpsAccuracy !== null && gpsAccuracy <= 30);
  const hasGpsFix = gpsAccuracy !== null;
  const gpsWeak = hasGpsFix && !gpsReady;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Footprints className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Start a Run</h1>
          <p className="text-sm text-muted-foreground">
            Get ready to hit the ground
          </p>
        </div>
      </div>

      {/* Readiness Card */}
      {readiness && <PreRunReadinessCard readiness={readiness} />}

      {/* Run Name */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Run Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning Run"
          className="rounded-xl"
        />
      </div>

      {/* Run Type */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Run Type
        </label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tag === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {RUN_TAG_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Treadmill Toggle */}
      <Card className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
        <div>
          <p className="text-sm font-medium">Treadmill Mode</p>
          <p className="text-xs text-muted-foreground">
            No GPS — enter distance manually after
          </p>
        </div>
        <button
          onClick={() => setIsTreadmill(!isTreadmill)}
          className={cn(
            "h-6 w-11 rounded-full transition-colors",
            isTreadmill ? "bg-primary" : "bg-muted"
          )}
        >
          <div
            className={cn(
              "h-5 w-5 rounded-full bg-white shadow transition-transform",
              isTreadmill ? "translate-x-[22px]" : "translate-x-[2px]"
            )}
          />
        </button>
      </Card>

      {/* GPS Status */}
      {!isTreadmill && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2">
            <Navigation
              className={cn(
                "h-4 w-4",
                gpsReady ? "text-green-400" : gpsWeak ? "text-red-400" : "text-yellow-400"
              )}
            />
            <span className="text-sm">
              {gpsError
                ? gpsError
                : !hasGpsFix && gpsAcquiring
                ? "Acquiring GPS signal..."
                : gpsReady
                  ? "GPS locked"
                  : "GPS signal weak"}
            </span>
          </div>
          <GpsStatusIndicator accuracy={gpsAccuracy} />
        </div>
      )}

      {/* Start Button */}
      <Button
        onClick={handleStart}
        disabled={!name.trim() || (!isTreadmill && !gpsReady)}
        size="lg"
        className="w-full rounded-xl text-lg"
      >
        {!isTreadmill && gpsAcquiring ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Waiting for GPS...
          </>
        ) : (
          "Start Tracking"
        )}
      </Button>

      {!isTreadmill && !gpsReady && (
        <Button
          variant="ghost"
          onClick={handleStart}
          className="w-full text-sm text-muted-foreground"
        >
          Start without GPS lock
        </Button>
      )}
    </div>
  );
}
