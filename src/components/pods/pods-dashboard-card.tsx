"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, TrendingUp, Loader2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PodWithMembers } from "@/types/pods";

interface PodSummary extends PodWithMembers {
  user_progress?: {
    commitment: number;
    completed: number;
    progress_percentage: number;
  };
}

export function PodsDashboardCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPods() {
      try {
        const res = await fetch("/api/pods");
        if (!res.ok) {
          const errorData = await res.json();
          console.error("❌ Dashboard card API error:", errorData);
          throw new Error(errorData.details || errorData.error || "Failed to load pods");
        }
        const data = await res.json();
        console.log("✅ Dashboard card pods loaded:", data.pods?.length || 0);
        setPods(data.pods || []);
      } catch (err) {
        console.error("Pods fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchPods();
  }, []);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || pods.length === 0) {
    return (
      <Card className="border-border/60 bg-card/85 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Accountability Pods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stay consistent with small accountability groups
          </p>
          <Button
            onClick={() => router.push("/pods/create")}
            className="motion-press w-full"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Pod
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show the first pod with progress
  const primaryPod = pods[0];
  const hasMultiple = pods.length > 1;

  const pressureGap = primaryPod.user_progress
    ? Math.max(0, primaryPod.user_progress.commitment - primaryPod.user_progress.completed)
    : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card/90 to-card/80 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Accountability Pods
          </CardTitle>
          {hasMultiple && (
            <Badge variant="secondary" className="text-xs">
              {pods.length} pods
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary Pod */}
        <div
          onClick={() => router.push(`/pods/${primaryPod.id}`)}
          className="cursor-pointer rounded-lg bg-background/55 p-3 space-y-2 hover:bg-background/80 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{primaryPod.name}</p>
              <p className="text-xs text-muted-foreground">
                {primaryPod.member_count} member{primaryPod.member_count !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </div>

          {/* Member avatars */}
          <div className="flex -space-x-2">
            {primaryPod.members.slice(0, 5).map((member, idx) => (
              <div
                key={member.user_id}
                className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-semibold"
                style={{ zIndex: 5 - idx }}
              >
                {(member.display_name || member.username || "?")[0].toUpperCase()}
              </div>
            ))}
            {primaryPod.member_count > 5 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                +{primaryPod.member_count - 5}
              </div>
            )}
          </div>

          {pressureGap != null ? (
            <div className="rounded-md border border-border/60 bg-secondary/35 px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Weekly Pressure</p>
              <p className="mt-1 text-sm font-medium">
                {pressureGap === 0 ? "Commitment on track. Keep pace." : `${pressureGap} workout${pressureGap === 1 ? "" : "s"} left this week`}
              </p>
            </div>
          ) : null}
        </div>

        {/* Action */}
        <Button
          onClick={() => router.push("/pods")}
          variant="outline"
          size="sm"
          className="motion-press w-full"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          {hasMultiple ? "View All Pods" : "View Pod"}
        </Button>
      </CardContent>
    </Card>
  );
}
