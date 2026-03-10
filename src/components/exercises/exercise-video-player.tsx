"use client";

import { useState, useEffect, useRef } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoMeta {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  difficulty: string | null;
}

interface ExerciseVideoPlayerProps {
  exerciseId: string;
  className?: string;
}

export function ExerciseVideoPlayer({ exerciseId, className }: ExerciseVideoPlayerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const videoIdRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSignedUrl = async (vid: string) => {
    const res = await fetch(`/api/exercises/${exerciseId}/video-url?videoId=${vid}`);
    if (!res.ok) throw new Error("Failed to get URL");
    const { signedUrl: url } = await res.json();
    return url as string;
  };

  const scheduleRefresh = (vid: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 30 seconds before the 5-min TTL expires (4.5 min = 270_000 ms)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const url = await fetchSignedUrl(vid);
        setSignedUrl(url);
        scheduleRefresh(vid);
      } catch {
        // Silently fail -- video may still be buffered
      }
    }, 270_000);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const videosRes = await fetch(`/api/exercises/${exerciseId}/videos`);
        if (!videosRes.ok) throw new Error("No videos");
        const videos: VideoMeta[] = await videosRes.json();
        if (!videos.length) throw new Error("No videos available");

        const first = videos[0];
        videoIdRef.current = first.id;
        const url = await fetchSignedUrl(first.id);

        if (!cancelled) {
          setVideoMeta(first);
          setSignedUrl(url);
          setStatus("ready");
          scheduleRefresh(first.id);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  if (status === "loading") {
    return (
      <div className={cn("aspect-video w-full animate-pulse rounded-xl bg-muted/30", className)} />
    );
  }

  if (status === "error" || !signedUrl) {
    return (
      <div className={cn("flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/20", className)}>
        <PlayCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-[11px] text-muted-foreground">Video unavailable</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/40", className)}>
      {videoMeta?.title && (
        <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
          {videoMeta.title}
          {videoMeta.difficulty && (
            <span className="ml-2 capitalize">{videoMeta.difficulty}</span>
          )}
        </p>
      )}
      <video
        src={signedUrl}
        controls
        playsInline
        preload="none"
        className="w-full aspect-video bg-black"
      />
    </div>
  );
}
