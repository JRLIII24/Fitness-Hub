"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FatigueSnapshot } from "@/lib/fatigue/types";

type Props = {
  initialSnapshot: FatigueSnapshot;
};

function meterTone(value: number): string {
  if (value >= 85) return "text-[var(--status-negative)]";
  if (value >= 70) return "text-[var(--status-warning)]";
  if (value >= 50) return "text-[var(--status-warning)]";
  return "text-[var(--status-positive)]";
}

export function FatigueLevelCard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<FatigueSnapshot>(initialSnapshot);
  const [saving, setSaving] = useState(false);
  const [checkin, setCheckin] = useState({
    sleep_quality: 7,
    soreness: 3,
    stress: 3,
    motivation: 8,
  });

  // Use snapshot timezone from the server to avoid hydration mismatch
  // (Intl.DateTimeFormat().resolvedOptions().timeZone differs on server vs client)
  const timezone = snapshot.timezone || "UTC";

  async function handleSubmitCheckin() {
    setSaving(true);
    try {
      const response = await fetch("/api/fatigue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checkin, timezone }),
      });

      if (!response.ok) {
        throw new Error("Could not save check-in");
      }

      const data = await response.json();
      if (data?.snapshot) {
        setSnapshot(data.snapshot as FatigueSnapshot);
      }
      toast.success("Recovery check-in saved.");
    } catch (error) {
      console.error("Check-in save failed:", error);
      toast.error("Failed to save check-in");
    } finally {
      setSaving(false);
    }
  }

  const contributors = [
    {
      key: "load",
      label: "Load",
      value: snapshot.loadSubscore,
      help: "sRPE × duration vs your rolling 7/28 day training load.",
    },
    {
      key: "recovery",
      label: "Recovery",
      value: snapshot.recoverySubscore,
      help: "Sleep, soreness, stress, and motivation from your daily check-in.",
    },
    {
      key: "performance",
      label: "Performance",
      value: snapshot.performanceSubscore,
      help: "Recent performance trend on trained compound lifts at similar effort when available.",
    },
  ] as const;

  return (
    <Card className="glass-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Fatigue Level
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                Why?
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-xs text-muted-foreground">
              Estimate based on training load, recent performance trends, and recovery check-ins.
              Improves with consistent logging.
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl glass-inner p-3">
          <div className="flex items-end justify-between">
            <p className="font-display text-4xl font-black leading-none tabular-nums text-[#F0F4FF]">{snapshot.fatigueScore}</p>
            <p className={`text-sm font-semibold ${meterTone(snapshot.fatigueScore)}`}>
              {snapshot.recommendation.label}
            </p>
          </div>
          <Progress value={snapshot.fatigueScore} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{snapshot.recommendation.guidance}</p>
        </div>

        <div className="space-y-2">
          {contributors.map((item) => (
            <div key={item.key} className="rounded-lg glass-inner px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium">{item.label}</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      {item.value}
                      <CircleHelp className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-xs text-muted-foreground">{item.help}</PopoverContent>
                </Popover>
              </div>
              <Progress value={item.value} className="h-1.5" />
            </div>
          ))}
        </div>

        {!snapshot.hasRecentSessions ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            No recent sessions logged. <Link href="/workout" className="underline">Log a workout</Link> to improve this estimate.
          </div>
        ) : null}

        {snapshot.needsSessionRpe ? (
          <div className="rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-3 text-xs text-[var(--status-warning)]">
            Missing session RPE on recent workouts. Add post-session effort ratings for better load accuracy.
          </div>
        ) : null}

        {!snapshot.hasRecoveryCheckin ? (
          <div className="rounded-xl glass-inner p-3 space-y-3">
            <p className="text-xs font-semibold">Quick check-in (today)</p>
            {([
              ["sleep_quality", "Sleep quality"],
              ["soreness", "Soreness"],
              ["stress", "Stress"],
              ["motivation", "Motivation"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">{checkin[field]}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[checkin[field]]}
                  onValueChange={(value) => {
                    setCheckin((prev) => ({ ...prev, [field]: value[0] ?? prev[field] }));
                  }}
                />
              </div>
            ))}
            <Button className="w-full" onClick={handleSubmitCheckin} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Check-in
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
