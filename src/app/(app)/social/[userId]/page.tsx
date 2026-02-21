"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SendPingDialog } from "@/components/social/send-ping-dialog";
import { MiniDashboardCard, type MiniDashboardProfile, type MiniTemplate, type ProfileClip } from "@/components/social/mini-dashboard-card";
import { useTemplateFavorites } from "@/hooks/use-template-favorites";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;

  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MiniDashboardProfile | null>(null);
  const [templates, setTemplates] = useState<MiniTemplate[]>([]);
  const [clips, setClips] = useState<ProfileClip[]>([]);
  const [favoritedTemplates, setFavoritedTemplates] = useState<MiniTemplate[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<{ session_name: string; started_at: string; exercise_count: number } | null>(null);
  const [workoutDays, setWorkoutDays] = useState<Date[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const { favoriteIds, toggleFavorite } = useTemplateFavorites(currentUserId);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      // Load profile (with streak)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, fitness_goal, current_streak, is_public")
        .eq("id", profileUserId)
        .eq("is_public", true)
        .single();

      if (profileError || !profileData) {
        toast.error("Profile not found or not public");
        router.back();
        return;
      }
      setProfile({
        ...profileData,
        current_streak: (profileData as { current_streak?: number }).current_streak ?? 0,
      });

      // Check if following
      const { data: followData } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileUserId)
        .maybeSingle();
      setIsFollowing(!!followData);

      // Load shared templates with save_count
      const { data: templateData } = await supabase
        .from("workout_templates")
        .select("id, name, description, save_count, template_exercises(id)")
        .eq("user_id", profileUserId)
        .eq("is_shared", true)
        .order("updated_at", { ascending: false });

      if (templateData) {
        setTemplates(
          templateData.map((t) => ({
            id: t.id,
            name: t.name,
            exercise_count: Array.isArray(t.template_exercises)
              ? t.template_exercises.length
              : 0,
            save_count: (t as { save_count?: number }).save_count ?? 0,
          }))
        );
      }

      // Load user's clips
      const { data: clipData } = await supabase
        .from("workout_clips")
        .select("id, video_url, thumbnail_url, clip_category, like_count")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(6);
      setClips(clipData ?? []);

      // Load templates this user has favorited
      const { data: favData } = await supabase
        .from("template_favorites")
        .select("template_id, workout_templates!template_favorites_template_id_fkey(id, name, save_count, template_exercises(id))")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (favData) {
        const favTemplates: MiniTemplate[] = favData
          .filter((f) => f.workout_templates)
          .map((f) => {
            const t = f.workout_templates as unknown as { id: string; name: string; save_count?: number; template_exercises: { id: string }[] };
            return {
              id: t.id,
              name: t.name,
              exercise_count: Array.isArray(t.template_exercises) ? t.template_exercises.length : 0,
              save_count: t.save_count ?? 0,
            };
          });
        setFavoritedTemplates(favTemplates);
      }

      // Load active workout status
      const { data: activeWorkoutData } = await supabase
        .from('active_workout_sessions')
        .select('session_name, started_at, exercise_count')
        .eq('user_id', profileUserId)
        .maybeSingle();
      setActiveWorkout(activeWorkoutData);

      // Load workout history (last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: workoutHistory } = await supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('user_id', profileUserId)
        .eq('status', 'completed')
        .gte('started_at', ninetyDaysAgo)
        .order('started_at', { ascending: false });

      const workoutDayDates = workoutHistory?.map(s => new Date(s.started_at)) ?? [];
      setWorkoutDays(workoutDayDates);

      setLoading(false);
    }
    load();
  }, [profileUserId, supabase, router]);

  async function handleFollow() {
    if (!currentUserId) return;
    setFollowLoading(true);
    try {
      const { error } = await supabase
        .from("user_follows")
        .insert({ follower_id: currentUserId, following_id: profileUserId });
      if (error) throw error;
      setIsFollowing(true);
      toast.success("Following!");
    } catch {
      toast.error("Failed to follow");
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleUnfollow() {
    if (!currentUserId) return;
    setFollowLoading(true);
    try {
      const { error } = await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profileUserId);
      if (error) throw error;
      setIsFollowing(false);
      toast.success("Unfollowed");
    } catch {
      toast.error("Failed to unfollow");
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleSendPing(message: string) {
    if (!currentUserId) return;
    const { error } = await supabase.from("pings").insert({
      sender_id: currentUserId,
      recipient_id: profileUserId,
      message,
    });
    if (error) throw error;
    toast.success("Ping sent! 💪");
  }

  async function handleCopyTemplate(template: MiniTemplate) {
    if (!currentUserId) return;
    setSavingTemplateId(template.id);

    try {
      const { data: source, error: sourceError } = await supabase
        .from("workout_templates")
        .select(`name, description, template_exercises(exercise_id, sort_order, template_exercise_sets(set_number, reps, weight_kg, set_type, rest_seconds))`)
        .eq("id", template.id)
        .single();

      if (sourceError || !source) throw sourceError ?? new Error("Not found");

      const { data: newTemplate, error: tplError } = await supabase
        .from("workout_templates")
        .insert({
          user_id: currentUserId,
          name: `${source.name} (copy)`,
          description: source.description,
          is_shared: false,
        })
        .select("id")
        .single();

      if (tplError || !newTemplate) throw tplError ?? new Error("Failed to create");

      const exercises = Array.isArray(source.template_exercises)
        ? source.template_exercises
        : [];

      for (const ex of exercises) {
        const { data: newEx, error: exError } = await supabase
          .from("template_exercises")
          .insert({
            template_id: newTemplate.id,
            exercise_id: ex.exercise_id,
            sort_order: ex.sort_order,
          })
          .select("id")
          .single();

        if (exError || !newEx) continue;

        const sets = Array.isArray(ex.template_exercise_sets)
          ? ex.template_exercise_sets
          : [];

        if (sets.length > 0) {
          await supabase.from("template_exercise_sets").insert(
            sets.map((s) => ({
              template_exercise_id: newEx.id,
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
              set_type: s.set_type,
              rest_seconds: s.rest_seconds,
            }))
          );
        }
      }

      // Increment save_count directly
      await supabase
        .from("workout_templates")
        .update({ save_count: template.save_count + 1 })
        .eq("id", template.id);

      // Update local save_count display
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, save_count: t.save_count + 1 } : t
        )
      );

      toast.success("Template saved to your library!");
      router.push("/templates");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSavingTemplateId(null);
    }
  }

  void followLoading;
  void savingTemplateId;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-28">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.back()} className="p-2">
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name || profile.username || "Anonymous";
  const isSelf = currentUserId === profileUserId;

  const templatesWithFavorites: MiniTemplate[] = templates.map((t) => ({
    ...t,
    isFavorited: favoriteIds.has(t.id),
  }));

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 space-y-4">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>

        <MiniDashboardCard
          profile={profile}
          clips={clips}
          templates={templatesWithFavorites}
          favoritedTemplates={favoritedTemplates}
          activeWorkout={activeWorkout}
          workoutDays={workoutDays}
          isFollowing={isFollowing}
          isSelf={isSelf}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          onPing={() => setPingOpen(true)}
          onCopyTemplate={handleCopyTemplate}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <SendPingDialog
        open={pingOpen}
        recipientName={displayName}
        onClose={() => setPingOpen(false)}
        onSend={handleSendPing}
      />
    </>
  );
}
