"use client";

import { useRef, useState, useEffect } from "react";
import { Heart, MessageCircle, Trash2, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WorkoutClip } from "@/hooks/use-clips";
import { CATEGORY_LABELS } from "@/lib/clip-categories";
import { MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";

interface ClipPlayerProps {
  clip: WorkoutClip;
  isActive: boolean;
  shouldPreload?: boolean;
  currentUserId: string | null;
  onLike: (clipId: string) => void;
  onUnlike: (clipId: string) => void;
  onOpenComments: (clipId: string) => void;
  onDelete?: (clipId: string) => void;
}

export function ClipPlayer({
  clip,
  isActive,
  shouldPreload = false,
  currentUserId,
  onLike,
  onUnlike,
  onOpenComments,
  onDelete,
}: ClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const lastTapRef = useRef(0);
  const likeBurstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (likeBurstTimeoutRef.current) clearTimeout(likeBurstTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  const displayName =
    clip.profiles?.display_name ?? clip.profiles?.username ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const isOwn = clip.user_id === currentUserId;
  const exerciseName = clip.exercises?.name ?? null;
  const muscleLabel =
    clip.exercises?.muscle_group != null
      ? MUSCLE_GROUP_LABELS[clip.exercises.muscle_group] ?? clip.exercises.muscle_group
      : null;
  const durationLabel =
    clip.duration_seconds && clip.duration_seconds > 0
      ? `${Math.floor(clip.duration_seconds / 60)}:${String(clip.duration_seconds % 60).padStart(2, "0")}`
      : null;

  const doLikeAction = () => {
    if (clip.isLiked) {
      onUnlike(clip.id);
      return;
    }
    onLike(clip.id);
    setShowLikeBurst(true);
    if (likeBurstTimeoutRef.current) clearTimeout(likeBurstTimeoutRef.current);
    likeBurstTimeoutRef.current = setTimeout(() => setShowLikeBurst(false), 520);
  };

  const handleVideoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      doLikeAction();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    setMuted((m) => !m);
  };

  return (
    <div className="relative w-full h-full bg-black select-none">
      {/* Video */}
      <video
        ref={videoRef}
        src={clip.video_url}
        poster={clip.thumbnail_url ?? undefined}
        className="w-full h-full object-contain"
        loop
        muted={muted}
        playsInline
        preload={shouldPreload ? "metadata" : "none"}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const current = e.currentTarget.currentTime;
          const total = e.currentTarget.duration || 0;
          setProgress(total > 0 ? Math.min(1, current / total) : 0);
        }}
        onClick={handleVideoTap}
      />

      {showLikeBurst ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/35 p-4 backdrop-blur-sm animate-[ping_520ms_ease-out_1]">
            <Heart className="size-10 fill-rose-500 text-rose-500" />
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 right-3 bottom-[92px] z-10">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          aria-label="Video progress"
          onChange={(e) => {
            const video = videoRef.current;
            if (!video || !duration) return;
            const next = (Number(e.target.value) / 1000) * duration;
            video.currentTime = next;
            setProgress(duration > 0 ? next / duration : 0);
          }}
          className="h-1.5 w-full cursor-pointer accent-white"
        />
      </div>

      {/* Mute indicator */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-16 bg-gradient-to-t from-black/80 to-transparent">
        {(exerciseName || muscleLabel || durationLabel) && (
          <div className="mb-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
            {exerciseName ? <span className="font-semibold normal-case tracking-normal">{exerciseName}</span> : null}
            {muscleLabel ? <span className="rounded-full bg-white/10 px-1.5 py-0.5">{muscleLabel}</span> : null}
            {durationLabel ? <span className="tabular-nums">{durationLabel}</span> : null}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="size-8 border border-white/30">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">
              {displayName}
            </p>
            <p className="text-white/60 text-xs">
              {formatDistanceToNow(new Date(clip.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        {/* Category pill */}
        {clip.clip_category && (
          <span className="inline-block rounded-full bg-primary/70 px-2 py-0.5 text-xs text-primary-foreground mb-2">
            {CATEGORY_LABELS[clip.clip_category] ?? clip.clip_category}
          </span>
        )}

        {/* Caption */}
        {clip.caption && (
          <p className="text-white text-sm mb-3 leading-snug">{clip.caption}</p>
        )}
      </div>

      {/* Right action bar */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        {/* Like */}
        <button
          onClick={doLikeAction}
          className="flex flex-col items-center gap-1"
          aria-label={clip.isLiked ? "Unlike" : "Like"}
        >
          <div
            className={`p-2.5 rounded-full backdrop-blur-sm ${
              clip.isLiked ? "bg-rose-500/80 motion-like-pulse" : "bg-black/50"
            }`}
          >
            <Heart
              className={`size-5 ${clip.isLiked ? "fill-white text-white" : "text-white"}`}
            />
          </div>
          <span className="text-white text-xs font-medium">
            {clip.like_count}
          </span>
        </button>

        {/* Comments */}
        <button
          onClick={() => onOpenComments(clip.id)}
          className="flex flex-col items-center gap-1"
          aria-label="Comments"
        >
          <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm">
            <MessageCircle className="size-5 text-white" />
          </div>
          <span className="text-white text-xs font-medium">
            {clip.comment_count}
          </span>
        </button>

        {/* Delete (own clips only) */}
        {isOwn && onDelete && (
          <button
            onClick={() => onDelete(clip.id)}
            className="flex flex-col items-center gap-1"
            aria-label="Delete clip"
          >
            <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm">
              <Trash2 className="size-5 text-white/70" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
