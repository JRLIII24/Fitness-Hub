"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export interface WorkoutCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionRpeValue: number;
  onSessionRpeChange: (value: number) => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * Post-workout session RPE prompt dialog.
 * Shown after the workout celebration and optional level-up modal close.
 */
export function WorkoutCompletionDialog({
  open,
  onOpenChange,
  sessionRpeValue,
  onSessionRpeChange,
  onSave,
  saving,
}: WorkoutCompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Session Effort</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quick post-session rating. This improves your fatigue estimate.
          </p>
          <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">What is sRPE?</p>
            <p className="mt-1">
              sRPE means <span className="font-semibold">Session Rate of Perceived Exertion</span>:
              how hard the <span className="font-semibold">entire workout</span> felt on a 0-10
              scale.
            </p>
            <p className="mt-1">
              0-2 = very easy, 3-5 = moderate, 6-8 = hard, 9-10 = near max effort.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Session RPE</span>
              <span className="font-semibold tabular-nums">{sessionRpeValue.toFixed(1)}</span>
            </div>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={[sessionRpeValue]}
              onValueChange={(value) => onSessionRpeChange(value[0] ?? 7)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Very easy</span>
              <span>Max effort</span>
            </div>
          </div>
          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Effort"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
