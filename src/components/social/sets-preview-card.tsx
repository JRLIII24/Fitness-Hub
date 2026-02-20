"use client";

import Link from "next/link";
import { Video, MessageCircle, Heart, Plus, ArrowUpRight, Pin, Play } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/clip-categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/hooks/use-supabase";
import { trackProfileSetOpened } from "@/lib/retention-events";

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

interface SetsPreviewCardProps {
  clips: ClipPreview[];
  pinnedClips?: ClipPreview[];
  currentUserId?: string | null;
}

export function SetsPreviewCard({
  clips,
  pinnedClips = [],
  currentUserId = null,
}: SetsPreviewCardProps) {
  const supabase = useSupabase();

  function trackOpen(clipId: string, location: "pinned" | "grid") {
    if (!currentUserId) return;
    void trackProfileSetOpened(supabase, currentUserId, { clip_id: clipId, location });
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-primary" />
              Your Sets Preview
            </CardTitle>
            <CardDescription className="text-xs">
              TikTok-style mini previews of your posted workout clips
            </CardDescription>
          </div>
          <Link href="/sets/upload">
            <Button size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Post
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {clips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-5 text-center">
            <p className="text-sm text-muted-foreground">No sets posted yet.</p>
            <Link href="/sets/upload">
              <Button variant="outline" size="sm" className="mt-3">
                Upload Your First Set
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pinnedClips.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Pin className="h-3 w-3" />
                  Pinned Top Sets
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {pinnedClips.slice(0, 3).map((clip, idx) => (
                    <Link
                      key={`pin-${clip.id}`}
                      href="/sets"
                      onClick={() => trackOpen(clip.id, "pinned")}
                      className="group relative overflow-hidden rounded-xl border border-primary/30 bg-black"
                      style={{ aspectRatio: "9 / 16" }}
                    >
                      {clip.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.caption ?? `Pinned clip ${idx + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={clip.video_url}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                        #{idx + 1}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-white/90">
                          <Heart className="h-3 w-3" />
                          <span>{clip.like_count ?? 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                All Sets
              </p>
              <div className="grid grid-cols-3 gap-2">
                {clips.map((clip) => (
                  <Link
                    key={clip.id}
                    href="/sets"
                    onClick={() => trackOpen(clip.id, "grid")}
                    className="group relative overflow-hidden rounded-xl border border-border/70 bg-black"
                    style={{ aspectRatio: "9 / 16" }}
                  >
                    {clip.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clip.thumbnail_url}
                        alt={clip.caption ?? "Workout clip"}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={clip.video_url}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-1.5">
                      <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        <Play className="h-2.5 w-2.5" />
                        {clip.clip_category ? CATEGORY_LABELS[clip.clip_category] ?? "Set" : "Set"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/85">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {clip.like_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {clip.comment_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <Link href="/sets">
          <Button variant="outline" className="w-full justify-between">
            Open Sets Feed
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
