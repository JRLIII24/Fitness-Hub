"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Dumbbell,
  Trophy,
  Flame,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedItem } from "@/app/api/social/feed/route";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() ?? "?";
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1).replace(/\.0$/, "")}k kg`;
  }
  return `${Math.round(kg).toLocaleString()} kg`;
}

function getActivityIcon(type: FeedItem["type"]) {
  switch (type) {
    case "workout_completed":
      return <Dumbbell className="size-4 text-primary" />;
    case "pr_achieved":
      return <Trophy className="size-4 text-yellow-500" />;
    case "streak_milestone":
      return <Flame className="size-4 text-orange-500" />;
  }
}

function getActivityDescription(item: FeedItem): string {
  const { type, data } = item;
  switch (type) {
    case "workout_completed": {
      const parts: string[] = [];
      if (data.duration_seconds) parts.push(formatDuration(data.duration_seconds));
      if (data.total_volume_kg) parts.push(formatVolume(data.total_volume_kg));
      const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return `completed ${data.session_name ?? "a workout"}${detail}`;
    }
    case "pr_achieved": {
      const weight = data.weight_kg ? `${data.weight_kg} kg` : "";
      const reps = data.reps ? ` x ${data.reps}` : "";
      const detail = weight ? ` (${weight}${reps})` : "";
      return `hit a PR on ${data.exercise_name ?? "an exercise"}${detail}`;
    }
    case "streak_milestone":
      return `is on a ${data.streak_count}-day streak`;
    default:
      return "did something";
  }
}

function FeedItemCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  const displayName = item.user.display_name || item.user.username || "Athlete";
  const relativeTime = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });

  return (
    <Card
      className="cursor-pointer glass-surface shimmer-target transition-colors"
      onClick={() => router.push(`/social/${item.user.id}`)}
    >
      <CardContent className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0 pt-0.5">
            <Avatar className="size-10">
              {item.user.avatar_url && (
                <AvatarImage src={item.user.avatar_url} alt={item.user.display_name ?? "User"} />
              )}
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {getInitials(item.user.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border/60 bg-card/90">
              {getActivityIcon(item.type)}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-semibold">{displayName}</span>{" "}
              <span className="text-muted-foreground">
                {getActivityDescription(item)}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {relativeTime}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="glass-surface">
          <CardContent className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/social/feed");
        if (!res.ok) {
          setError("Failed to load feed");
          return;
        }
        const json = await res.json();
        setItems(json.items ?? []);
      } catch {
        setError("Failed to load feed");
      } finally {
        setLoading(false);
      }
    }
    void fetchFeed();
  }, []);

  if (loading) return <FeedSkeleton />;

  if (error) {
    return (
      <Card className="glass-surface">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="glass-surface">
        <CardContent className="py-10 text-center">
          <Activity className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No recent activity</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow athletes to see their workouts, PRs, and streaks here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <FeedItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
