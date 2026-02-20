"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, ChevronRight, Loader2, Clock } from "lucide-react";
import { getCachedPrediction, cachePrediction, clearExpiredCache } from "@/lib/launcher-cache";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LauncherPrediction } from "@/types/adaptive";

interface AlternativeTemplate {
  id: string;
  name: string;
  exercise_count: number;
  last_used_at: string;
}

interface LauncherResponse {
  suggested_workout: LauncherPrediction;
  alternative_templates: AlternativeTemplate[];
}

export function SmartLauncherWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<LauncherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    async function fetchLauncher() {
      try {
        // Clear expired cache entries on mount
        clearExpiredCache().catch(console.error);

        // Get current user ID from auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[Launcher] No authenticated user');
          setLoading(false);
          return;
        }

        // Check cache first
        const cached = await getCachedPrediction(user.id);
        if (cached) {
          console.log('[Launcher] Serving from cache');
          setData(cached);
          setLoading(false);
        }

        // Fetch from API
        const res = await fetch("/api/workout/launcher");
        if (res.status === 403) {
          // Feature not enabled - hide widget
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load launcher");

        const json = await res.json();

        // Update cache with fresh data
        setData(json);
        await cachePrediction(user.id, json);

        if (!cached) {
          // Only stop loading if we didn't show cached data
          setLoading(false);
        }
      } catch (err) {
        console.error("Launcher fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    }
    fetchLauncher();
  }, []);

  async function handleStartWorkout(templateId: string | null, accepted: boolean) {
    setStarting(true);
    const startTime = Date.now();

    try {
      // Log acceptance/rejection
      await fetch("/api/workout/launcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          accepted,
          time_to_decision_ms: Date.now() - startTime,
        }),
      });

      // For saved templates: pass template_id in URL
      if (templateId) {
        router.push(`/workout?template_id=${templateId}&from_launcher=true`);
      } else {
        // For preset workouts: store in sessionStorage
        if (data?.suggested_workout) {
          sessionStorage.setItem('launcher_prediction', JSON.stringify(data.suggested_workout));
        }
        router.push("/workout?from_launcher=true");
      }
    } catch (err) {
      console.error("Failed to start workout:", err);
      setStarting(false);
    }
  }

  // Hide widget if feature not enabled or error
  if (!loading && (!data || error)) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const { suggested_workout, alternative_templates } = data!;
  const confidence = suggested_workout.confidence;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Launcher
          </CardTitle>
          <Badge
            variant={
              confidence === "high"
                ? "default"
                : confidence === "medium"
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            {confidence === "high" ? "High Match" : confidence === "medium" ? "Good Match" : "Suggested"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">{suggested_workout.template_name}</p>
          <p className="text-xs text-muted-foreground">{suggested_workout.reason}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {suggested_workout.exercises.length} exercises
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{suggested_workout.estimated_duration_mins} min
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => handleStartWorkout(suggested_workout.template_id, true)}
            disabled={starting}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Start Workout
              </>
            )}
          </Button>

          {alternative_templates.length > 0 && (
            <Sheet open={showAlternatives} onOpenChange={setShowAlternatives}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" disabled={starting}>
                  Swap
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Alternative Templates</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {alternative_templates.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => {
                        setShowAlternatives(false);
                        handleStartWorkout(alt.id, false);
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      <p className="font-medium text-sm">{alt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {alt.exercise_count} exercises • Last used{" "}
                        {new Date(alt.last_used_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAlternatives(false);
                      // Log rejection without starting a specific workout
                      fetch("/api/workout/launcher", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          template_id: null,
                          accepted: false,
                          time_to_decision_ms: Date.now() - Date.now(),
                          reason: 'start_from_scratch'
                        }),
                      }).catch(err => console.error('Failed to log launcher rejection:', err));
                      // Navigate to empty workout page
                      router.push("/workout");
                    }}
                    className="w-full rounded-lg border border-dashed border-border/60 bg-background p-3 text-left transition-colors hover:bg-secondary/30"
                  >
                    <p className="font-medium text-sm flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Start from scratch
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Build a custom workout
                    </p>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
