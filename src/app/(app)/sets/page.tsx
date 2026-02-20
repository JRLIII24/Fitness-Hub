"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClips, type ClipFeedMode } from "@/hooks/use-clips";
import { ClipFeed } from "@/components/sets/clip-feed";
import { PillSelector } from "@/components/ui/pill-selector";
import { Card, CardContent } from "@/components/ui/card";

export default function SetsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<ClipFeedMode>("discover");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const {
    clips,
    loading,
    hasMore,
    followingCount,
    loadMore,
    likeClip,
    unlikeClip,
    deleteClip,
    fetchComments,
    postComment,
  } = useClips(userId, feedMode);

  return (
    <div className="relative h-[calc(100svh-56px)] overflow-hidden bg-black">
      <div className="absolute top-3 left-1/2 z-10 w-[min(520px,calc(100%-1rem))] -translate-x-1/2">
        <Card className="border-white/20 bg-black/55 backdrop-blur">
          <CardContent className="px-2 py-2">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">
              Sets
            </p>
            <PillSelector
              value={feedMode}
              onChange={(v) => setFeedMode(v as ClipFeedMode)}
              ariaLabel="Sets feed mode"
              options={[
                { value: "discover", label: "Discover" },
                { value: "following", label: `Following (${followingCount})` },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <ClipFeed
        clips={clips}
        loading={loading}
        hasMore={hasMore}
        currentUserId={userId}
        onLike={likeClip}
        onUnlike={unlikeClip}
        onDelete={deleteClip}
        onLoadMore={loadMore}
        fetchComments={fetchComments}
        postComment={postComment}
      />
    </div>
  );
}
