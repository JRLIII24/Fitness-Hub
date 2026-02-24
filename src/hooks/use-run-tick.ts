"use client";

import { useEffect } from "react";
import { useRunStore } from "@/stores/run-store";

export function useRunTick() {
  const lifecycleState = useRunStore((s) => s.lifecycleState);
  const tick = useRunStore((s) => s.tick);

  useEffect(() => {
    if (lifecycleState !== "running") return;

    const id = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(id);
  }, [lifecycleState, tick]);

  return {
    elapsedSeconds: useRunStore.getState().getElapsedSeconds(),
    movingSeconds: useRunStore.getState().getMovingSeconds(),
  };
}
