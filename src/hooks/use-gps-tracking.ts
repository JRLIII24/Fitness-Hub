"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRunStore } from "@/stores/run-store";
import type { GpsPoint, RunIntensityZone } from "@/types/run";
import { haversineDistanceM } from "@/lib/run/geo";
import { shouldAcceptPoint, computeElevationDelta } from "@/lib/run/gps-smoother";
import { computeRollingPaceSecPerKm, computeAvgPaceSecPerKm } from "@/lib/run/pace";
import { classifyPaceZone, computeZoneThresholds } from "@/lib/run/zones";
import { appendGpsPoint, flushGpsPoints } from "@/lib/run/track-store";
import { logger } from "@/lib/logger";

interface PaceWindowEntry {
  distM: number;
  timestampMs: number;
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20000,
};

const AUTO_PAUSE_SPEED_MS = 0.5;
const AUTO_PAUSE_DURATION_MS = 3000; // 3 s is enough to distinguish a genuine stop
const AUTO_RESUME_SPEED_MS = 0.8;

export function useGpsTracking() {
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAcceptedRef = useRef<GpsPoint | null>(null);
  const lastCoordinateAtRef = useRef<number>(0);
  const paceWindowRef = useRef<PaceWindowEntry[]>([]);
  const cumulativeDistRef = useRef(0);
  const elevationGainRef = useRef(0);
  const elevationLossRef = useRef(0);
  const bestPaceRef = useRef(Infinity);
  const slowSinceRef = useRef<number | null>(null);
  const zoneThresholdsRef = useRef(computeZoneThresholds());

  const {
    lifecycleState,
    activeRun,
    recordGpsUpdate,
    autoPause,
    autoResume,
    completeSplit,
  } = useRunStore();

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const state = useRunStore.getState();
      if (
        state.lifecycleState !== "running" &&
        state.lifecycleState !== "auto_paused"
      )
        return;
      lastCoordinateAtRef.current = Date.now();

      const point: GpsPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: Date.now(),
      };

      // Update GPS accuracy even if point rejected
      useRunStore.setState((s) =>
        s.activeRun
          ? {
              activeRun: {
                ...s.activeRun,
                gpsAccuracy: point.accuracy,
                lastGpsTimestamp: point.timestamp,
              },
            }
          : s
      );

      const lastAccepted = lastAcceptedRef.current;
      const elapsedMs = lastAccepted
        ? point.timestamp - lastAccepted.timestamp
        : 0;
      const distFromPrevRaw = lastAccepted
        ? haversineDistanceM(
            lastAccepted.lat,
            lastAccepted.lng,
            point.lat,
            point.lng
          )
        : 0;
      const fallbackSpeedMs =
        elapsedMs > 0 ? distFromPrevRaw / (elapsedMs / 1000) : 0;
      const speedMs = point.speed ?? fallbackSpeedMs;

      // Auto-pause/resume logic
      if (state.lifecycleState === "running" || state.lifecycleState === "auto_paused") {
        if (state.lifecycleState === "running" && speedMs < AUTO_PAUSE_SPEED_MS) {
          if (!slowSinceRef.current) {
            slowSinceRef.current = Date.now();
          } else if (Date.now() - slowSinceRef.current > AUTO_PAUSE_DURATION_MS) {
            autoPause();
            return;
          }
        } else if (state.lifecycleState === "auto_paused" && speedMs > AUTO_RESUME_SPEED_MS) {
          slowSinceRef.current = null;
          autoResume();
          return;
        } else {
          slowSinceRef.current = null;
        }
      }

      if (state.lifecycleState !== "running") return;

      if (!shouldAcceptPoint(point, lastAccepted, elapsedMs)) return;

      // Calculate distance from previous accepted point
      const distFromPrev = distFromPrevRaw;

      cumulativeDistRef.current += distFromPrev;
      lastAcceptedRef.current = point;

      // Pace
      const rollingPace = computeRollingPaceSecPerKm(paceWindowRef.current, {
        distM: distFromPrev,
        timestampMs: point.timestamp,
      });

      const movingSec = state.getMovingSeconds();
      const avgPace = computeAvgPaceSecPerKm(cumulativeDistRef.current, movingSec);

      if (rollingPace > 0 && rollingPace < bestPaceRef.current) {
        bestPaceRef.current = rollingPace;
      }

      // Zone
      const zone: RunIntensityZone = classifyPaceZone(
        rollingPace,
        zoneThresholdsRef.current
      );

      // Elevation
      const elevDelta = computeElevationDelta(
        point.altitude,
        lastAccepted?.altitude ?? null
      );
      const elevGainDelta = elevDelta > 0 ? elevDelta : 0;
      const elevLossDelta = elevDelta < 0 ? Math.abs(elevDelta) : 0;
      elevationGainRef.current += elevGainDelta;
      elevationLossRef.current += elevLossDelta;

      // Store GPS point in IDB
      if (state.activeRun) {
        appendGpsPoint(state.activeRun.id, point);
      }

      // Update store
      recordGpsUpdate({
        distFromPrevM: distFromPrev,
        cumulativeDistM: cumulativeDistRef.current,
        paceSecPerKm: rollingPace,
        avgPaceSecPerKm: avgPace,
        bestPaceSecPerKm: bestPaceRef.current === Infinity ? 0 : bestPaceRef.current,
        zone,
        altitude: point.altitude,
        cumulativeElevationGainM: elevationGainRef.current,
        cumulativeElevationLossM: elevationLossRef.current,
        accuracy: point.accuracy,
        speedMs,
        elapsedMsSinceLastPoint: Math.max(elapsedMs, 0),
      });

      const syncedRun = useRunStore.getState().activeRun;
      if (syncedRun) {
        cumulativeDistRef.current = syncedRun.distanceM;
        elevationGainRef.current = syncedRun.elevationGainM;
        elevationLossRef.current = syncedRun.elevationLossM;
      }

      // Check for split completion
      if (state.activeRun && cumulativeDistRef.current >= state.activeRun.nextSplitDistanceM) {
        const run = state.activeRun;
        const splitDist = run.nextSplitDistanceM - run.currentSplitStartDistanceM;
        const splitDurationMs = point.timestamp - run.currentSplitStartedAt;
        const splitDurationSec = Math.round(splitDurationMs / 1000);
        const splitPace = splitDist > 0 ? (splitDurationSec / splitDist) * 1000 : 0;

        completeSplit({
          id: crypto.randomUUID(),
          run_session_id: run.id,
          user_id: "",
          split_number: run.splits.length + 1,
          split_distance_meters: splitDist,
          duration_seconds: splitDurationSec,
          pace_sec_per_km: splitPace,
          elevation_gain_m: null,
          elevation_loss_m: null,
          zone,
          lat: point.lat,
          lng: point.lng,
          started_at: new Date(run.currentSplitStartedAt).toISOString(),
          completed_at: new Date(point.timestamp).toISOString(),
        });
      }
    },
    [recordGpsUpdate, autoPause, autoResume, completeSplit]
  );

  const startWatching = useCallback((resetTrackingRefs = true) => {
    if (!navigator.geolocation) {
      logger.error("Geolocation not supported");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (resetTrackingRefs) {
      const run = useRunStore.getState().activeRun;
      lastAcceptedRef.current = null;
      paceWindowRef.current = [];
      cumulativeDistRef.current = run?.distanceM ?? 0;
      elevationGainRef.current = run?.elevationGainM ?? 0;
      elevationLossRef.current = run?.elevationLossM ?? 0;
      bestPaceRef.current =
        run && run.bestPaceSecPerKm > 0 ? run.bestPaceSecPerKm : Infinity;
      slowSinceRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => {
        logger.error("GPS error:", error.message);
      },
      GPS_OPTIONS
    );
    lastCoordinateAtRef.current = Date.now();
  }, [handlePosition]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    // Flush any pending GPS points
    const run = useRunStore.getState().activeRun;
    if (run) {
      flushGpsPoints(run.id);
    }
  }, []);

  // Auto-start/stop GPS watch based on lifecycle state
  useEffect(() => {
    if (
      (lifecycleState === "running" || lifecycleState === "auto_paused") &&
      watchIdRef.current === null
    ) {
      startWatching();
    } else if (
      lifecycleState !== "running" &&
      lifecycleState !== "auto_paused" &&
      lifecycleState !== "paused" &&
      watchIdRef.current !== null
    ) {
      stopWatching();
    }

    return () => {
      if (
        lifecycleState === "idle" ||
        lifecycleState === "completed" ||
        lifecycleState === "saving"
      ) {
        stopWatching();
      }
    };
  }, [lifecycleState, startWatching, stopWatching]);

  useEffect(() => {
    if (lifecycleState === "running" || lifecycleState === "auto_paused") {
      if (heartbeatRef.current !== null) return;
      heartbeatRef.current = setInterval(() => {
        const state = useRunStore.getState();
        const isActivelyTracking =
          state.lifecycleState === "running" ||
          state.lifecycleState === "auto_paused";
        if (!isActivelyTracking) return;
        if (Date.now() - lastCoordinateAtRef.current > 15000) {
          startWatching(false);
        }
      }, 5000);
      return;
    }

    if (heartbeatRef.current !== null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [lifecycleState, startWatching]);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current !== null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);

  return {
    startWatching,
    stopWatching,
    gpsAccuracy: activeRun?.gpsAccuracy ?? null,
    isWatching:
      lifecycleState === "running" ||
      lifecycleState === "auto_paused" ||
      lifecycleState === "paused",
  };
}
