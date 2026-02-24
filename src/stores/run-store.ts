"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActiveRun,
  RunLifecycleState,
  RunSplit,
  RunTag,
  RunIntensityZone,
  ZoneBreakdown,
} from "@/types/run";

const MOVING_SPEED_THRESHOLD_MS = 0.5;

const EMPTY_ZONE_BREAKDOWN: ZoneBreakdown = {
  zone1_active_recovery: 0,
  zone2_aerobic: 0,
  zone3_tempo: 0,
  zone4_threshold: 0,
  zone5_anaerobic: 0,
};

interface RunState {
  lifecycleState: RunLifecycleState;
  activeRun: ActiveRun | null;
  lastTickMs: number;

  // Actions
  initRun: (name: string, tag: RunTag | null, isTreadmill?: boolean, splitDistanceM?: number) => string;
  startTracking: () => void;
  recordGpsUpdate: (update: {
    distFromPrevM: number;
    cumulativeDistM: number;
    paceSecPerKm: number;
    avgPaceSecPerKm: number;
    bestPaceSecPerKm: number;
    zone: RunIntensityZone;
    altitude: number | null;
    cumulativeElevationGainM: number;
    cumulativeElevationLossM: number;
    accuracy: number;
    speedMs: number;
    elapsedMsSinceLastPoint: number;
  }) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  autoPause: () => void;
  autoResume: () => void;
  completeSplit: (split: RunSplit) => void;
  endRun: () => void;
  cancelRun: () => void;
  setSaving: () => void;
  setCompleted: () => void;
  tick: () => void;

  getElapsedSeconds: () => number;
  getMovingSeconds: () => number;
}

let tickIntervalId: ReturnType<typeof setInterval> | null = null;
let rehydrateGet: (() => RunState) | null = null;
let rehydrateSet: ((partial: Partial<RunState>) => void) | null = null;

function startTickLoop(
  get: () => RunState,
  set: (partial: Partial<RunState>) => void
) {
  if (tickIntervalId) clearInterval(tickIntervalId);
  tickIntervalId = setInterval(() => {
    const state = get();
    if (state.lifecycleState === "running") {
      set({ lastTickMs: Date.now() });
    }
  }, 1000);
}

function stopTickLoop() {
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

export const useRunStore = create<RunState>()(
  persist(
    (set, get) => ({
      lifecycleState: "idle",
      activeRun: null,
      lastTickMs: 0,

      initRun: (name, tag, isTreadmill = false, splitDistanceM = 1609.34) => {
        const runId = crypto.randomUUID();
        const now = Date.now();

        set({
          lifecycleState: "ready",
          activeRun: {
            id: runId,
            name,
            tag,
            startedAt: now,
            pausedAt: null,
            totalPausedMs: 0,
            isTreadmill,
            distanceM: 0,
            currentPaceSecPerKm: 0,
            avgPaceSecPerKm: 0,
            bestPaceSecPerKm: 0,
            elevationGainM: 0,
            elevationLossM: 0,
            lastAltitude: null,
            splits: [],
            nextSplitDistanceM: splitDistanceM,
            currentSplitStartedAt: now,
            currentSplitStartDistanceM: 0,
            zoneSeconds: { ...EMPTY_ZONE_BREAKDOWN },
            currentZone: null,
            gpsAccuracy: null,
            lastGpsTimestamp: null,
            autoPauseThresholdMs: 0.5,
            movingTimeMs: 0,
          },
          lastTickMs: now,
        });

        return runId;
      },

      startTracking: () => {
        const now = Date.now();
        set((state) => ({
          lifecycleState: "running" as RunLifecycleState,
          activeRun: state.activeRun
            ? {
                ...state.activeRun,
                startedAt: now,
                currentSplitStartedAt: now,
              }
            : state.activeRun,
          lastTickMs: now,
        }));
        startTickLoop(get, set);
      },

      recordGpsUpdate: (update) => {
        set((state) => {
          if (!state.activeRun || state.lifecycleState !== "running")
            return state;

          const run = state.activeRun;
          const newZoneSeconds = { ...run.zoneSeconds };
          newZoneSeconds[update.zone] += 1;

          return {
            activeRun: {
              ...run,
              distanceM: update.cumulativeDistM,
              currentPaceSecPerKm: update.paceSecPerKm,
              avgPaceSecPerKm: update.avgPaceSecPerKm,
              bestPaceSecPerKm: update.bestPaceSecPerKm,
              elevationGainM: update.cumulativeElevationGainM,
              elevationLossM: update.cumulativeElevationLossM,
              lastAltitude: update.altitude,
              zoneSeconds: newZoneSeconds,
              currentZone: update.zone,
              gpsAccuracy: update.accuracy,
              lastGpsTimestamp: Date.now(),
              movingTimeMs:
                run.movingTimeMs +
                (update.speedMs >= MOVING_SPEED_THRESHOLD_MS
                  ? update.elapsedMsSinceLastPoint
                  : 0),
            },
          };
        });
      },

      pauseRun: () => {
        set((state) => ({
          lifecycleState: "paused" as RunLifecycleState,
          activeRun: state.activeRun
            ? { ...state.activeRun, pausedAt: Date.now() }
            : state.activeRun,
        }));
        stopTickLoop();
      },

      resumeRun: () => {
        set((state) => {
          if (!state.activeRun?.pausedAt)
            return { lifecycleState: "running" as RunLifecycleState };
          const additionalPausedMs = Date.now() - state.activeRun.pausedAt;
          return {
            lifecycleState: "running" as RunLifecycleState,
            activeRun: {
              ...state.activeRun,
              pausedAt: null,
              totalPausedMs:
                state.activeRun.totalPausedMs + additionalPausedMs,
            },
            lastTickMs: Date.now(),
          };
        });
        startTickLoop(get, set);
      },

      autoPause: () => {
        set((state) => ({
          lifecycleState: "auto_paused" as RunLifecycleState,
          activeRun: state.activeRun
            ? { ...state.activeRun, pausedAt: Date.now() }
            : state.activeRun,
        }));
      },

      autoResume: () => {
        set((state) => {
          if (!state.activeRun?.pausedAt)
            return { lifecycleState: "running" as RunLifecycleState };
          const additionalPausedMs = Date.now() - state.activeRun.pausedAt;
          return {
            lifecycleState: "running" as RunLifecycleState,
            activeRun: {
              ...state.activeRun,
              pausedAt: null,
              totalPausedMs:
                state.activeRun.totalPausedMs + additionalPausedMs,
            },
          };
        });
        startTickLoop(get, set);
      },

      completeSplit: (split) => {
        set((state) => {
          if (!state.activeRun) return state;
          return {
            activeRun: {
              ...state.activeRun,
              splits: [...state.activeRun.splits, split],
              nextSplitDistanceM:
                state.activeRun.nextSplitDistanceM +
                split.split_distance_meters,
              currentSplitStartedAt: Date.now(),
              currentSplitStartDistanceM: state.activeRun.distanceM,
            },
          };
        });
      },

      endRun: () => set({ lifecycleState: "finishing" }),

      cancelRun: () => {
        stopTickLoop();
        set({ lifecycleState: "idle", activeRun: null });
      },

      setSaving: () => set({ lifecycleState: "saving" }),

      setCompleted: () => {
        stopTickLoop();
        set({ lifecycleState: "completed", activeRun: null });
      },

      tick: () => set({ lastTickMs: Date.now() }),

      getElapsedSeconds: () => {
        const state = get();
        if (!state.activeRun) return 0;
        const { startedAt, totalPausedMs, pausedAt } = state.activeRun;
        const now = Date.now();
        const currentPauseDuration = pausedAt ? now - pausedAt : 0;
        return Math.floor(
          (now - startedAt - totalPausedMs - currentPauseDuration) / 1000
        );
      },

      getMovingSeconds: () => {
        const state = get();
        if (!state.activeRun) return 0;
        if (state.activeRun.isTreadmill) return state.getElapsedSeconds();
        return Math.floor(state.activeRun.movingTimeMs / 1000);
      },
    }),
    {
      name: "fit-hub-run",
      partialize: (state) => ({
        lifecycleState: state.lifecycleState,
        activeRun: state.activeRun,
        lastTickMs: state.lastTickMs,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const now = Date.now();
        if (state.lifecycleState === "running" && state.activeRun) {
          const gapMs = Math.max(0, now - state.lastTickMs);
          state.activeRun = {
            ...state.activeRun,
            totalPausedMs: state.activeRun.totalPausedMs + gapMs,
          };
          state.lastTickMs = now;
          if (rehydrateGet && rehydrateSet) {
            startTickLoop(rehydrateGet, rehydrateSet);
          }
          return;
        }

        if (
          (state.lifecycleState === "paused" ||
            state.lifecycleState === "auto_paused") &&
          state.activeRun &&
          !state.activeRun.pausedAt
        ) {
          state.activeRun = {
            ...state.activeRun,
            pausedAt: now,
          };
          state.lastTickMs = now;
        } else if (state.lifecycleState !== "running") {
          state.lastTickMs = now;
          stopTickLoop();
        }

        if (state.lifecycleState === "running") {
          if (rehydrateGet && rehydrateSet) {
            startTickLoop(rehydrateGet, rehydrateSet);
          }
        } else {
          stopTickLoop();
        }
      },
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as Partial<RunState>),
        };
        if (!merged.lastTickMs) {
          merged.lastTickMs = Date.now();
        }
        if (
          merged.activeRun &&
          typeof merged.activeRun.movingTimeMs !== "number"
        ) {
          merged.activeRun = {
            ...merged.activeRun,
            movingTimeMs: 0,
          };
        }
        return merged;
      },
    }
  )
);

rehydrateGet = useRunStore.getState;
rehydrateSet = (partial) => useRunStore.setState(partial);
