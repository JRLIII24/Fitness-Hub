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

import { useVirtualizer } from '@tanstack/react-virtual';

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
  const viewedClipIdsRef = useRef<Set<string>>(new Set());
  const supabase = useSupabase();

  const virtualizer = useVirtualizer({
    count: hasMore ? clips.length + 1 : clips.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => window.innerHeight || 800,
    overscan: 2,
  });

  // Track the most visible active index from virtualizer
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const centerIndex = virtualItems[Math.floor(virtualItems.length / 2)].index;
    if (centerIndex < clips.length && centerIndex !== activeIndex) {
      setActiveIndex(centerIndex);
    }

    const lastItem = virtualItems[virtualItems.length - 1];
    if (hasMore && !loading && lastItem && lastItem.index >= clips.length) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), activeIndex, clips.length, hasMore, loading, onLoadMore]);

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
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const isLoaderRow = virtualRow.index > clips.length - 1;
            const clip = clips[virtualRow.index];
            const i = virtualRow.index;

            return (
              <div
                key={isLoaderRow ? 'loader' : clip.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="w-full flex items-center justify-center bg-black snap-start snap-always"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: 'calc(100svh - 56px)',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {isLoaderRow ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>
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
