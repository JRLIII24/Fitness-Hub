"use client";

import { useRunStore } from "@/stores/run-store";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square } from "lucide-react";

export function RunControls() {
  const lifecycleState = useRunStore((s) => s.lifecycleState);
  const pauseRun = useRunStore((s) => s.pauseRun);
  const resumeRun = useRunStore((s) => s.resumeRun);
  const endRun = useRunStore((s) => s.endRun);

  const isPaused =
    lifecycleState === "paused" || lifecycleState === "auto_paused";
  const isRunning = lifecycleState === "running";

  return (
    <div className="flex items-center justify-center gap-4">
      {(isRunning || isPaused) && (
        <>
          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full border-destructive/50 text-destructive"
            onClick={endRun}
          >
            <Square className="h-6 w-6 fill-current" />
          </Button>

          <Button
            size="lg"
            className="h-20 w-20 rounded-full text-lg"
            onClick={isPaused ? resumeRun : pauseRun}
          >
            {isPaused ? (
              <Play className="h-8 w-8 fill-current" />
            ) : (
              <Pause className="h-8 w-8 fill-current" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}
