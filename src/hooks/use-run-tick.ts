"use client";

import { useRunStore } from "@/stores/run-store";

/**
 * Subscribes to the run store tick for UI re-render purposes.
 *
 * The run-store's startTickLoop() is the SINGLE setInterval authority.
 * This hook must NOT create its own setInterval — the previous implementation
 * did so, causing tick() (and therefore set({ lastTickMs })) to fire TWICE
 * per second: once from the store loop, once from the hook's own interval.
 *
 * Fix: subscribe to lastTickMs from the store. When the store ticks, this
 * hook's component re-renders and the computed values (wall-clock based)
 * are always accurate at render time — no local interval needed.
 *
 * DEV: To verify single-tick, add console.count('[RunStore] tick') inside
 * run-store.ts startTickLoop and confirm it fires exactly once per second.
 */
export function useRunTick() {
  // Subscribing to lastTickMs drives re-renders when the store ticks.
  // The value itself is unused here; the subscription is the purpose.
  const lastTickMs = useRunStore((s) => s.lastTickMs);
  void lastTickMs;

  return {
    elapsedSeconds: useRunStore.getState().getElapsedSeconds(),
    movingSeconds: useRunStore.getState().getMovingSeconds(),
  };
}
