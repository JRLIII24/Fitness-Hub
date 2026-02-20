"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Settings, Flame, Lock, Globe, Target, Trophy } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { SetsPreviewCard } from "@/components/social/sets-preview-card";

interface ProfileData {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  is_public: boolean;
  current_streak: number;
}

interface ActivityStats {
  setsPosted: number;
  templatesShared: number;
  podsJoined: number;
}

interface ClipPreview {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  clip_category: string | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
}

export function ProfileTabContent() {
  const router = useRouter();
  const supabase = useSupabase();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<ActivityStats>({ setsPosted: 0, templatesShared: 0, podsJoined: 0 });
  const [clips, setClips] = useState<ClipPreview[]>([]);
  const [pinnedClips, setPinnedClips] = useState<ClipPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile data
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, fitness_goal, is_public, current_streak")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          id: data.id,
          email: user.email ?? "",
          display_name: data.display_name,
          username: data.username,
          bio: data.bio,
          fitness_goal: data.fitness_goal,
          is_public: data.is_public,
          current_streak: data.current_streak ?? 0,
        });

        // Fetch activity stats in parallel
        const [clipsCount, templatesCount, podsCount, clipsResult] = await Promise.all([
          // Sets posted
          supabase
            .from("workout_clips")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),

          // Templates shared
          supabase
            .from("workout_templates")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_shared", true),

          // Pods joined
          supabase
            .from("pod_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active"),

          // Sets preview
          supabase
            .from("workout_clips")
            .select("id, video_url, thumbnail_url, caption, clip_category, like_count, comment_count, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(18),
        ]);

        setStats({
          setsPosted: clipsCount.count ?? 0,
          templatesShared: templatesCount.count ?? 0,
          podsJoined: podsCount.count ?? 0,
        });
        const loadedClips = (clipsResult.data ?? []) as ClipPreview[];
        setClips(loadedClips);
        setPinnedClips(
          [...loadedClips]
            .sort(
              (a, b) =>
                ((b.like_count ?? 0) * 1.4 + (b.comment_count ?? 0) * 2.2) -
                ((a.like_count ?? 0) * 1.4 + (a.comment_count ?? 0) * 2.2)
            )
            .slice(0, 3)
        );
      }
      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "User";
  const goalLabel = profile.fitness_goal
    ? profile.fitness_goal.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
    : null;

  return (
    <div className="space-y-4 mt-4">
      {/* Profile Card */}
      <Card className="relative overflow-hidden border-border/70 bg-card/85">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Profile</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/settings")}
            >
              <Edit className="size-4 mr-1.5" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {displayName[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
                <p className="text-lg font-semibold">{displayName}</p>
                {profile.username && (
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                )}
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            {profile.current_streak > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Flame className="mr-1 size-3 text-orange-400" />
                {profile.current_streak} day streak
              </Badge>
            )}
            {goalLabel && (
              <Badge variant="secondary" className="text-xs">
                <Target className="mr-1 size-3 text-primary" />
                {goalLabel}
              </Badge>
            )}
            <Badge variant={profile.is_public ? "default" : "outline"} className="text-xs">
              {profile.is_public ? (
                <>
                  <Globe className="mr-1 size-3" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="mr-1 size-3" />
                  Private
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings CTA */}
      <Card className="border-2 border-dashed border-border/70">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Manage Your Profile</p>
              <p className="text-xs text-muted-foreground">
                Update your display name, bio, fitness goals, and privacy settings
              </p>
            </div>
            <Button size="sm" onClick={() => router.push("/settings")}>
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={<Trophy className="h-4 w-4 text-primary" />}
          value={stats.setsPosted}
          label="Sets Posted"
          className="border-border/70 bg-card/80"
        />
        <StatCard
          icon={<Edit className="h-4 w-4 text-primary" />}
          value={stats.templatesShared}
          label="Shared"
          className="border-border/70 bg-card/80"
        />
        <StatCard
          icon={<Settings className="h-4 w-4 text-primary" />}
          value={stats.podsJoined}
          label="Pods"
          className="border-border/70 bg-card/80"
        />
      </div>

      <SetsPreviewCard clips={clips} pinnedClips={pinnedClips} currentUserId={profile.id} />
    </div>
  );
}
