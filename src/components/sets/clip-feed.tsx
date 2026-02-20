"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ClipPlayer } from "./clip-player";
import { ClipCommentSheet } from "./clip-comment-sheet";
import type { WorkoutClip } from "@/hooks/use-clips";
import { Loader2 } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { trackClipCommentsOpened, trackClipViewed } from "@/lib/retention-events";

interface ClipFeedProps {
  clips: WorkoutClip[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string | null;
  onLike: (clipId: string) => void;
  onUnlike: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onLoadMore: () => void;
  fetchComments: (clipId: string) => Promise<import("@/hooks/use-clips").ClipComment[]>;
  postComment: (clipId: string, content: string) => Promise<import("@/hooks/use-clips").ClipComment | null>;
}

export function ClipFeed({
  clips,
  loading,
  hasMore,
  currentUserId,
  onLike,
  onUnlike,
  onDelete,
  onLoadMore,
  fetchComments,
  postComment,
}: ClipFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentClipId, setCommentClipId] = useState<string | null>(null);
  const [commentClipOwnerId, setCommentClipOwnerId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewedClipIdsRef = useRef<Set<string>>(new Set());
  const supabase = useSupabase();

  // IntersectionObserver: activate the clip that is most visible
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    itemRefs.current.forEach((el, index) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveIndex(index);
          }
        },
        { threshold: 0.6 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [clips.length]);

  // Load more when last clip becomes visible
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || loading || !hasMore) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            onLoadMore();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [loading, hasMore, onLoadMore]
  );

  useEffect(() => {
    const activeClip = clips[activeIndex];
    if (!currentUserId || !activeClip) return;
    if (viewedClipIdsRef.current.has(activeClip.id)) return;
    viewedClipIdsRef.current.add(activeClip.id);

    void trackClipViewed(supabase, currentUserId, {
      clip_id: activeClip.id,
      clip_owner_id: activeClip.user_id,
      index: activeIndex,
      feed_mode_hint: "discover",
    });
  }, [activeIndex, clips, currentUserId, supabase]);

  if (clips.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
        <p className="text-foreground text-base font-semibold tracking-tight">Sets is quiet right now</p>
        <p className="text-muted-foreground text-sm mt-1">
          Post your next set or follow more lifters to bring today&apos;s session feed to life.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {clips.map((clip, i) => (
          <div
            key={clip.id}
            ref={(el) => {
              itemRefs.current[i] = el;
              if (i === clips.length - 1) lastItemRef(el);
            }}
            className="w-full snap-start snap-always flex items-center justify-center bg-black"
            style={{ height: "calc(100svh - 56px)" }}
          >
            {/* Cap width so 9:16 video is fully visible on desktop */}
            <div className="relative w-full h-full max-w-[420px]">
              <ClipPlayer
                clip={clip}
                isActive={i === activeIndex}
                shouldPreload={Math.abs(i - activeIndex) <= 2}
                currentUserId={currentUserId}
                onLike={onLike}
                onUnlike={onUnlike}
                onOpenComments={(clipId) => {
                  if (currentUserId) {
                    void trackClipCommentsOpened(supabase, currentUserId, { clip_id: clipId });
                  }
                  setCommentClipId(clipId);
                  setCommentClipOwnerId(clip.user_id);
                }}
                onDelete={onDelete}
              />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <ClipCommentSheet
        clipId={commentClipId}
        clipOwnerId={commentClipOwnerId}
        currentUserId={currentUserId}
        onClose={() => { setCommentClipId(null); setCommentClipOwnerId(null); }}
        fetchComments={fetchComments}
        postComment={postComment}
      />
    </>
  );
}
