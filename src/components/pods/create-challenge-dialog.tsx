"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Trophy, Flame } from "lucide-react";
import type { ChallengeType, CreateChallengeInput } from "@/types/pods";

interface CreateChallengeDialogProps {
  open: boolean;
  podId: string;
  onClose: () => void;
  onCreated: () => void;
}

const CHALLENGE_TYPES: {
  key: ChallengeType;
  label: string;
  description: string;
  unit: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "volume",
    label: "Volume",
    description: "Total kg lifted across workouts",
    unit: "kg target",
    icon: <Trophy className="h-4 w-4" />,
  },
  {
    key: "consistency",
    label: "Consistency",
    description: "Workouts completed",
    unit: "sessions target",
    icon: <Flame className="h-4 w-4" />,
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function CreateChallengeDialog({
  open,
  podId,
  onClose,
  onCreated,
}: CreateChallengeDialogProps) {
  const [name, setName] = useState("");
  const [challengeType, setChallengeType] = useState<ChallengeType>("volume");
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(weekFromNow);
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }

    const body: CreateChallengeInput & { pod_id?: string } = {
      name: name.trim(),
      challenge_type: challengeType,
      start_date: startDate,
      end_date: endDate,
      target_value: targetValue ? Number(targetValue) : undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/pods/${podId}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create challenge");
        return;
      }

      toast.success("Challenge created!");
      setName("");
      setChallengeType("volume");
      setStartDate(todayIso());
      setEndDate(weekFromNow());
      setTargetValue("");
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create challenge");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType = CHALLENGE_TYPES.find((t) => t.key === challengeType)!;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Challenge</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-name">Challenge name</Label>
            <Input
              id="challenge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beast Week"
              maxLength={100}
              required
              minLength={2}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Challenge type</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHALLENGE_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChallengeType(t.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                    challengeType === t.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
                  )}
                >
                  <span
                    className={cn(
                      challengeType === t.key ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {t.icon}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{selectedType.description}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Optional target */}
          <div className="space-y-1.5">
            <Label htmlFor="target-value">
              Target{" "}
              <span className="text-muted-foreground font-normal">
                ({selectedType.unit}, optional)
              </span>
            </Label>
            <Input
              id="target-value"
              type="number"
              min={0.1}
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={`e.g. ${challengeType === "volume" ? "10000" : "5"}`}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create Challenge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
