"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Zap, Battery, BatteryLow, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AdaptiveWorkoutData {
  template_id: string | null;
  template_name: string;
  exercises: Array<{
    exercise: {
      id: string;
      name: string;
      muscle_group: string;
    };
    target_sets: number;
    target_reps: number;
  }>;
  estimated_duration_mins: number;
  confidence: string;
  reason: string;
  fatigueScore: number;
  adaptationType: 'REST' | 'VOLUME' | 'INTENSITY';
  adaptationReason: string;
  volumeAdjustment: number;
}

export function AdaptiveWorkoutCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<AdaptiveWorkoutData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdaptiveWorkout() {
      try {
        const res = await fetch("/api/workout/adaptive");
        if (!res.ok) throw new Error("Failed to load adaptive workout");

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Adaptive workout fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchAdaptiveWorkout();
  }, []);

  async function handleStartWorkout() {
    if (!data) return;

    setStarting(true);

    try {
      // Log acceptance
      await fetch("/api/workout/adaptive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: data.template_id,
          accepted: true,
          adaptation_type: data.adaptationType
        }),
      });

      // For saved templates: pass template_id in URL
      if (data.template_id) {
        router.push(`/workout?template_id=${data.template_id}&from_adaptive=true&volume_adj=${data.volumeAdjustment}`);
      } else {
        // For preset workouts: store in sessionStorage
        sessionStorage.setItem('adaptive_workout', JSON.stringify(data));
        router.push("/workout?from_adaptive=true");
      }
    } catch (err) {
      console.error("Failed to start adaptive workout:", err);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Hide on error
  }

  const fatiguePercentage = data.fatigueScore;

  // Determine colors and description based on fatigue score
  // Green (0-39): Fresh/Low fatigue
  // Yellow (40-69): Medium/Normal fatigue
  // Red (70-100): High fatigue
  let fatigueColor: string;
  let progressBarClasses: string;
  let fatigueDescription: string;

  if (data.fatigueScore >= 70) {
    fatigueColor = "text-red-500";
    progressBarClasses = "h-1.5 [&>div]:!bg-red-500";
    fatigueDescription = "High fatigue - your body needs recovery time";
  } else if (data.fatigueScore >= 40) {
    fatigueColor = "text-yellow-500";
    progressBarClasses = "h-1.5 [&>div]:!bg-yellow-500";
    fatigueDescription = "Medium fatigue - normal training recommended";
  } else {
    fatigueColor = "text-green-500";
    progressBarClasses = "h-1.5 [&>div]:!bg-green-500";
    fatigueDescription = "Low fatigue - great time to push harder";
  }

  const adaptationBadge = {
    REST: { label: "🔋 Recovery", variant: "secondary" as const, color: "text-blue-500" },
    VOLUME: { label: "⚖️ Normal", variant: "outline" as const, color: "text-yellow-500" },
    INTENSITY: { label: "💪 Push", variant: "default" as const, color: "text-green-500" }
  }[data.adaptationType];

  const FatigueIcon = data.fatigueScore >= 50 ? BatteryLow : Battery;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-violet-500/5 to-indigo-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Adaptive Workout
          </CardTitle>
          <Badge variant={adaptationBadge.variant} className="text-[10px]">
            {adaptationBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fatigue Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FatigueIcon className={`h-4 w-4 ${fatigueColor}`} />
              <span className="text-xs font-medium text-muted-foreground">Fatigue Level</span>
            </div>
            <span className={`text-sm font-bold ${fatigueColor}`}>
              {data.fatigueScore}/100
            </span>
          </div>
          <Progress value={fatiguePercentage} className={progressBarClasses} />
          <p className="text-[10px] text-muted-foreground italic mt-1">
            {fatigueDescription}
          </p>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
          <p className="text-sm font-semibold">{data.template_name}</p>
          <p className="text-xs text-muted-foreground">{data.adaptationReason}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {data.exercises.length} exercises
            </span>
            <span>~{data.estimated_duration_mins} min</span>
            {data.volumeAdjustment !== 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {data.volumeAdjustment > 0 ? '+' : ''}{data.volumeAdjustment}% volume
              </Badge>
            )}
          </div>
        </div>

        {/* Start Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleStartWorkout}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-4 w-4" />
              Start Adaptive Workout
            </>
          )}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          Based on your recent training volume and recovery patterns
        </p>
      </CardContent>
    </Card>
  );
}
