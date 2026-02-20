"use client";

import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SetCommitmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSetCommitment: (workouts: number) => Promise<void>;
  currentCommitment?: number;
}

export function SetCommitmentDialog({
  open,
  onClose,
  onSetCommitment,
  currentCommitment = 0,
}: SetCommitmentDialogProps) {
  const [selected, setSelected] = useState(currentCommitment || 3);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    await onSetCommitment(selected);
    setLoading(false);
  }

  const options = [1, 2, 3, 4, 5, 6, 7];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Set Weekly Goal
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            How many workouts will you complete this week?
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Workouts per week</Label>
            <div className="grid grid-cols-7 gap-2">
              {options.map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={selected === num ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelected(num)}
                  className="aspect-square p-0"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p className="font-semibold">Your commitment:</p>
            <p className="text-muted-foreground">
              {selected} workout{selected !== 1 ? "s" : ""} this week (Mon-Sun)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting...
              </>
            ) : (
              "Set Goal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
