"use client";

import { Flame, Dumbbell, Copy, Heart, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileWorkoutCalendar } from "./profile-workout-calendar";

export interface MiniTemplate {
  id: string;
  name: string;
  exercise_count: number;
  save_count: number;
  isFavorited?: boolean;
}

export interface MiniDashboardProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  current_streak: number;
  is_public: boolean;
  avatar_url?: string | null;
}

interface MiniDashboardCardProps {
  profile: MiniDashboardProfile;
  templates: MiniTemplate[];
  favoritedTemplates: MiniTemplate[];
  activeWorkout?: { session_name: string; started_at: string; exercise_count: number } | null;
  workoutDays?: Date[];
  isFollowing: boolean;
  isSelf: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onPing: () => void;
  onCopyTemplate: (template: MiniTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  improve_endurance: "Improve Endurance",
  stay_active: "Stay Active",
  sport_performance: "Sport Performance",
};

export function MiniDashboardCard({
  profile,
  templates,
  favoritedTemplates,
  activeWorkout,
  workoutDays,
  isFollowing,
  isSelf,
  onFollow,
  onUnfollow,
  onPing,
  onCopyTemplate,
  onToggleFavorite,
}: MiniDashboardCardProps) {
  const displayName = profile.display_name ?? profile.username ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const goalLabel = profile.fitness_goal
    ? (GOAL_LABELS[profile.fitness_goal] ?? profile.fitness_goal)
    : null;

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-14 shrink-0">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="text-base font-semibold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base leading-tight truncate">
                {displayName}
              </h2>
              {profile.username && (
                <p className="text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-foreground/80 mt-1 leading-snug line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {activeWorkout && (
              <div className="flex items-center gap-1.5 bg-green-500/10 rounded-full px-3 py-1 animate-pulse">
                <Activity className="size-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-500">
                  Working out now <Dumbbell className="inline size-3.5 ml-0.5" />
                </span>
              </div>
            )}
            {profile.current_streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 rounded-full px-3 py-1">
                <Flame className="size-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500">
                  {profile.current_streak}-day streak
                </span>
              </div>
            )}
            {goalLabel && (
              <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                <Dumbbell className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {goalLabel}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isSelf && (
            <div className="flex gap-2">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="flex-1"
                onClick={isFollowing ? onUnfollow : onFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onPing}
              >
                Ping <Dumbbell className="inline size-3.5 ml-0.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout calendar */}
      {workoutDays && workoutDays.length > 0 && (
        <ProfileWorkoutCalendar workoutDays={workoutDays} />
      )}

      {/* Shared templates */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground px-1">
            Shared Templates
          </p>
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{tpl.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {tpl.exercise_count} exercises
                      </span>
                      {tpl.save_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0"
                        >
                          {tpl.save_count}{" "}
                          {tpl.save_count === 1 ? "athlete" : "athletes"} running
                          this
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSelf && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => onToggleFavorite(tpl.id)}
                          aria-label={
                            tpl.isFavorited
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <Heart
                            className={`size-4 ${tpl.isFavorited ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => onCopyTemplate(tpl)}
                          aria-label="Copy template"
                        >
                          <Copy className="size-4 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No shared templates yet.
        </p>
      )}

      {/* Favorited templates */}
      {favoritedTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground px-1">
            Favorited Templates
          </p>
          {favoritedTemplates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Heart className="size-4 text-rose-500 fill-rose-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{tpl.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {tpl.exercise_count} exercises
                    </span>
                  </div>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      onClick={() => onCopyTemplate(tpl)}
                      aria-label="Copy template"
                    >
                      <Copy className="size-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
