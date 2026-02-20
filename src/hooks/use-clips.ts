"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSupabase } from "./use-supabase";
import {
  trackClipCommentPosted,
  trackClipDeleted,
  trackClipLike,
  trackClipUnlike,
  trackClipUploaded,
} from "@/lib/retention-events";

export interface ClipProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url?: string | null;
}

export interface WorkoutClip {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration_seconds: number | null;
  clip_category: string | null;
  exercise_id: string | null;
  template_id: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles?: ClipProfile;
  exercises?: { name: string | null; muscle_group: string | null } | null;
  isLiked?: boolean;
}

export interface ClipComment {
  id: string;
  clip_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: ClipProfile;
}

export interface UploadClipParams {
  videoFile: File;
  thumbnailBlob?: Blob;
  caption?: string;
  clipCategory?: string;
  exerciseId?: string;
  templateId?: string;
  durationSeconds?: number;
}

const PAGE_SIZE = 30;
export type ClipFeedMode = "discover" | "following";

function scoreClip(
  clip: { like_count: number; comment_count: number; created_at: string; user_id: string },
  mode: ClipFeedMode,
  followingIds: Set<string>,
  currentUserId: string | null
) {
  const ageHours = (Date.now() - new Date(clip.created_at).getTime()) / 3_600_000;
  const freshness = Math.max(0, 72 - ageHours) / 72; // 0..1 in first 72h
  const engagement = clip.like_count * 1.2 + clip.comment_count * 2.1;
  const followingBoost = followingIds.has(clip.user_id) ? 2 : 0;
  const ownPenalty = clip.user_id === currentUserId ? 0 : 0;
  const discoverSpreadBoost = mode === "discover" ? Math.min(2, ageHours / 24) * 0.35 : 0;
  return engagement + freshness * 6 + followingBoost + ownPenalty + discoverSpreadBoost;
}

export function useClips(userId: string | null, mode: ClipFeedMode = "discover") {
  const supabase = useSupabase();
  const [clips, setClips] = useState<WorkoutClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function loadFollowing() {
      const { data } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", userId);
      if (!active) return;
      setFollowingIds(new Set((data ?? []).map((row) => row.following_id)));
    }
    void loadFollowing();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const fetchClips = useCallback(
    async (reset = false) => {
      if (!userId) return;
      setLoading(true);

      const cursor = reset ? null : cursorRef.current;

      let query = supabase
        .from("workout_clips")
        .select(
          `id, user_id, video_url, thumbnail_url, caption, duration_seconds, clip_category, exercise_id, template_id, like_count, comment_count, created_at,
           profiles!workout_clips_user_id_fkey(id, display_name, username),
           exercises!workout_clips_exercise_id_fkey(name, muscle_group)`
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE * 3);

      if (mode === "following") {
        const ids = [userId, ...Array.from(followingIds)];
        if (ids.length === 0) {
          setClips([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        query = query.in("user_id", ids);
      }

      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Fetch which clips the current user has liked
      const clipIds = data.map((c) => c.id);
      const { data: likedData } = await supabase
        .from("clip_likes")
        .select("clip_id")
        .eq("user_id", userId)
        .in("clip_id", clipIds);

      const likedSet = new Set((likedData ?? []).map((l) => l.clip_id));

      const mapped: WorkoutClip[] = data.map((c) => ({
        ...c,
        profiles: Array.isArray(c.profiles) ? c.profiles[0] : (c.profiles as ClipProfile | undefined),
        exercises: Array.isArray(c.exercises)
          ? c.exercises[0]
          : (c.exercises as { name: string | null; muscle_group: string | null } | null),
        isLiked: likedSet.has(c.id),
      }));

      const ranked = [...mapped]
        .sort(
          (a, b) =>
            scoreClip(b, mode, followingIds, userId) - scoreClip(a, mode, followingIds, userId)
        )
        .slice(0, PAGE_SIZE);

      if (reset) {
        setClips(ranked);
      } else {
        setClips((prev) => {
          const combined = [...prev, ...ranked];
          const seen = new Set<string>();
          return combined.filter((clip) => {
            if (seen.has(clip.id)) return false;
            seen.add(clip.id);
            return true;
          });
        });
      }

      if (data.length < PAGE_SIZE * 3) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (data.length > 0) {
        cursorRef.current = data[data.length - 1].created_at;
      }

      setLoading(false);
    },
    [userId, supabase, mode, followingIds]
  );

  useEffect(() => {
    if (!userId) return;
    cursorRef.current = null;
    setHasMore(true);
    fetchClips(true);
  }, [userId, fetchClips, mode]);

  // Realtime: new clips + count updates
  // Security note: Subscriptions rely on RLS to filter events. UPDATE events only
  // modify clips already in state (which passed RLS on initial fetch), so if a clip
  // UPDATE comes through for a clip not in state, it's ignored. INSERT events are
  // client-filtered to exclude own clips (handled by uploadClip optimistic update).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("clip-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "workout_clips" },
        (payload) => {
          const newClip = payload.new as WorkoutClip;
          if (mode === "following") {
            const visibleIds = new Set([userId, ...Array.from(followingIds)]);
            if (!visibleIds.has(newClip.user_id)) return;
          }
          // Skip own clips (handled by upload)
          if (newClip.user_id === userId) return;
          setClips((prev) => [{ ...newClip, isLiked: false }, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workout_clips" },
        (payload) => {
          const updated = payload.new as WorkoutClip;
          // Only update clips already in state (RLS-filtered on initial load)
          setClips((prev) =>
            prev.map((c) =>
              c.id === updated.id
                ? { ...c, like_count: updated.like_count, comment_count: updated.comment_count }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, mode, followingIds]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchClips(false);
    }
  }, [loading, hasMore, fetchClips]);

  const likeClip = useCallback(
    async (clipId: string) => {
      if (!userId) return;
      // Optimistic
      setClips((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? { ...c, isLiked: true, like_count: c.like_count + 1 }
            : c
        )
      );
      const { error } = await supabase
        .from("clip_likes")
        .insert({ clip_id: clipId, user_id: userId });
      if (error) {
        // Rollback
        setClips((prev) =>
          prev.map((c) =>
            c.id === clipId
              ? { ...c, isLiked: false, like_count: Math.max(0, c.like_count - 1) }
              : c
          )
        );
      } else {
        void trackClipLike(supabase, userId, { clip_id: clipId, mode });
      }
    },
    [userId, supabase, mode]
  );

  const unlikeClip = useCallback(
    async (clipId: string) => {
      if (!userId) return;
      // Optimistic
      setClips((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? { ...c, isLiked: false, like_count: Math.max(0, c.like_count - 1) }
            : c
        )
      );
      const { error } = await supabase
        .from("clip_likes")
        .delete()
        .eq("clip_id", clipId)
        .eq("user_id", userId);
      if (error) {
        // Rollback
        setClips((prev) =>
          prev.map((c) =>
            c.id === clipId
              ? { ...c, isLiked: true, like_count: c.like_count + 1 }
              : c
          )
        );
      } else {
        void trackClipUnlike(supabase, userId, { clip_id: clipId, mode });
      }
    },
    [userId, supabase, mode]
  );

  const deleteClip = useCallback(
    async (clipId: string) => {
      if (!userId) return;
      setClips((prev) => prev.filter((c) => c.id !== clipId));
      await supabase
        .from("workout_clips")
        .delete()
        .eq("id", clipId)
        .eq("user_id", userId);
      void trackClipDeleted(supabase, userId, { clip_id: clipId, mode });
    },
    [userId, supabase, mode]
  );

  const uploadClip = useCallback(
    async ({
      videoFile,
      thumbnailBlob,
      caption,
      clipCategory,
      exerciseId,
      templateId,
      durationSeconds,
    }: UploadClipParams): Promise<WorkoutClip | null> => {
      if (!userId) return null;

      // Security: validate file type and size
      const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
      if (!ALLOWED_TYPES.includes(videoFile.type)) {
        throw new Error("Invalid file type. Only MP4, MOV, or WebM are allowed.");
      }
      if (videoFile.size > 500 * 1024 * 1024) {
        throw new Error("File too large. Maximum size is 500 MB.");
      }

      const ext = videoFile.name.split(".").pop() ?? "mp4";
      const clipId = crypto.randomUUID();
      const path = `${userId}/${clipId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("workout-clips")
        .upload(path, videoFile, { contentType: videoFile.type });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from("workout-clips")
        .getPublicUrl(path);

      const videoUrl = urlData.publicUrl;

      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (thumbnailBlob) {
        const thumbPath = `${userId}/${clipId}_thumb.jpg`;
        const { error: thumbError } = await supabase.storage
          .from("workout-clips")
          .upload(thumbPath, thumbnailBlob, { contentType: "image/jpeg" });
        if (!thumbError) {
          const { data: thumbData } = supabase.storage
            .from("workout-clips")
            .getPublicUrl(thumbPath);
          thumbnailUrl = thumbData.publicUrl;
        }
      }

      const { data, error: insertError } = await supabase
        .from("workout_clips")
        .insert({
          id: clipId,
          user_id: userId,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          caption: caption ?? null,
          duration_seconds: durationSeconds ?? null,
          clip_category: clipCategory ?? null,
          exercise_id: exerciseId ?? null,
          template_id: templateId ?? null,
        })
        .select(
          `id, user_id, video_url, thumbnail_url, caption, duration_seconds, clip_category, exercise_id, template_id, like_count, comment_count, created_at,
           profiles!workout_clips_user_id_fkey(id, display_name, username),
           exercises!workout_clips_exercise_id_fkey(name, muscle_group)`
        )
        .single();

      if (insertError || !data) {
        throw new Error(insertError?.message ?? "Failed to save clip");
      }

      const newClip: WorkoutClip = {
        ...data,
        profiles: Array.isArray(data.profiles)
          ? data.profiles[0]
          : (data.profiles as ClipProfile | undefined),
        exercises: Array.isArray(data.exercises)
          ? data.exercises[0]
          : (data.exercises as { name: string | null; muscle_group: string | null } | null),
        isLiked: false,
      };

      setClips((prev) => [newClip, ...prev]);
      void trackClipUploaded(supabase, userId, {
        clip_id: newClip.id,
        clip_category: newClip.clip_category,
        has_caption: Boolean(newClip.caption),
        duration_seconds: newClip.duration_seconds,
      });
      return newClip;
    },
    [userId, supabase]
  );

  const fetchComments = useCallback(
    async (clipId: string): Promise<ClipComment[]> => {
      const { data, error } = await supabase
        .from("clip_comments")
        .select(
          `id, clip_id, user_id, content, created_at,
           profiles!clip_comments_user_id_fkey(id, display_name, username)`
        )
        .eq("clip_id", clipId)
        .order("created_at", { ascending: true });

      if (error || !data) return [];

      return data.map((c) => ({
        ...c,
        profiles: Array.isArray(c.profiles)
          ? c.profiles[0]
          : (c.profiles as ClipProfile | undefined),
      }));
    },
    [supabase]
  );

  const postComment = useCallback(
    async (clipId: string, content: string): Promise<ClipComment | null> => {
      if (!userId) return null;

      // Optimistically increment comment count before DB call
      setClips((prev) =>
        prev.map((c) =>
          c.id === clipId ? { ...c, comment_count: c.comment_count + 1 } : c
        )
      );

      const { data, error } = await supabase
        .from("clip_comments")
        .insert({ clip_id: clipId, user_id: userId, content })
        .select(
          `id, clip_id, user_id, content, created_at,
           profiles!clip_comments_user_id_fkey(id, display_name, username)`
        )
        .single();

      if (error || !data) {
        // Rollback optimistic update on failure
        setClips((prev) =>
          prev.map((c) =>
            c.id === clipId ? { ...c, comment_count: Math.max(0, c.comment_count - 1) } : c
          )
        );
        return null;
      }

      void trackClipCommentPosted(supabase, userId, {
        clip_id: clipId,
        mode,
        length: content.length,
      });

      return {
        ...data,
        profiles: Array.isArray(data.profiles)
          ? data.profiles[0]
          : (data.profiles as ClipProfile | undefined),
      };
    },
    [userId, supabase, mode]
  );

  return {
    clips,
    loading,
    hasMore,
    followingCount: followingIds.size,
    loadMore,
    likeClip,
    unlikeClip,
    deleteClip,
    uploadClip,
    fetchComments,
    postComment,
  };
}
