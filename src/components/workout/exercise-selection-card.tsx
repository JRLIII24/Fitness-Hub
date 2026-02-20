"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Zap, TrendingUp, Target } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";

interface PreviousPerformance {
  reps: number | null;
  weight: number | null;
  performedAt?: string | null;
}

interface ExerciseSelectionCardProps {
  exercise: Exercise;
  mediaUrl: string | null;
  posterUrl?: string | null;
  primaryBenefit: string;
  coachingCues: string[];
  previousPerformance?: PreviousPerformance | null;
  selected: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
}

function isVideoAsset(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.includes(".mp4?") ||
    lower.includes(".webm?") ||
    lower.includes(".mov?")
  );
}

export function ExerciseSelectionCard({
  exercise,
  mediaUrl,
  posterUrl,
  primaryBenefit,
  coachingCues,
  previousPerformance,
  selected,
  onSelect,
  onQuickAdd,
}: ExerciseSelectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const panelId = useId();

  const isVideo = useMemo(() => (mediaUrl ? isVideoAsset(mediaUrl) : false), [mediaUrl]);
  const shouldPlayVideo = Boolean(isVideo && (selected || expanded || hovered || inView));

  const muscleLabel =
    MUSCLE_GROUP_LABELS[exercise.muscle_group as keyof typeof MUSCLE_GROUP_LABELS] ??
    exercise.muscle_group ??
    "General";
  const equipmentLabel =
    (exercise.equipment && EQUIPMENT_LABELS[exercise.equipment as keyof typeof EQUIPMENT_LABELS]) ??
    exercise.equipment ??
    "Bodyweight";

  useEffect(() => {
    const node = mediaRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.2),
      { threshold: [0, 0.2, 0.6] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    if (shouldPlayVideo) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVideo, shouldPlayVideo]);

  function formatLastPerformance() {
    if (!previousPerformance) return "No logged history yet";
    const hasWeight = previousPerformance.weight != null;
    const hasReps = previousPerformance.reps != null;
    if (!hasWeight && !hasReps) return "No logged history yet";

    const weight = hasWeight ? `${previousPerformance.weight}kg` : "BW";
    const reps = hasReps ? `${previousPerformance.reps}` : "—";
    return `LAST: ${weight} × ${reps}`;
  }

  function handlePrimaryTap() {
    if (!selected) {
      onSelect();
      setExpanded(true);
      return;
    }
    setExpanded((v) => !v);
  }

  function handleToggleExpand() {
    if (!selected) onSelect();
    setExpanded((v) => !v);
  }

  const showPoster = !isVideo || !shouldPlayVideo;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        selected
          ? "border-primary/70 shadow-[0_0_20px_rgba(255,255,255,0.09)]"
          : "border-border/70 hover:border-border"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div ref={mediaRef} className="relative h-56 w-full bg-black">
        {!mediaLoaded ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted/40 via-muted/65 to-muted/40" />
        ) : null}

        {mediaUrl && isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              showPoster ? "opacity-0" : "opacity-100"
            )}
            loop
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setMediaLoaded(true)}
          />
        ) : null}

        {showPoster ? (
          posterUrl || (!isVideo && mediaUrl) ? (
            <img
              src={posterUrl ?? mediaUrl ?? ""}
              alt={exercise.name}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                mediaLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setMediaLoaded(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs uppercase tracking-[0.12em] text-muted-foreground">
              No Preview
            </div>
          )
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge variant="secondary" className="border-white/20 bg-black/35 text-[10px] uppercase tracking-[0.12em] text-white backdrop-blur">
            {muscleLabel}
          </Badge>
          <Badge variant="secondary" className="border-white/20 bg-black/35 text-[10px] uppercase tracking-[0.12em] text-white/90 backdrop-blur">
            {equipmentLabel}
          </Badge>
        </div>

        <button
          type="button"
          aria-label={expanded ? "Collapse exercise details" : "Expand exercise details"}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
          className={cn(
            "absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
            expanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handlePrimaryTap}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="absolute inset-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/90"
        >
          <span className="sr-only">
            {selected ? "Toggle details for" : "Select"} {exercise.name}
          </span>
        </button>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight text-white">
            {exercise.name}
          </p>
        </div>
      </div>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[grid-template-rows,opacity]",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 bg-card px-4 pb-4 pt-3">
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Primary Training Benefit</p>
              <p className="mt-1 text-sm font-medium text-foreground">{primaryBenefit}</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Previous Performance</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatLastPerformance()}</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Coaching Cues</p>
              {coachingCues.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {coachingCues.slice(0, 2).map((cue, index) => (
                    <li key={index} className="text-sm text-foreground/90">
                      {cue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Detailed cue guidance coming soon.</p>
              )}
            </div>

            <Button
              type="button"
              className="h-10 w-full justify-between"
              aria-label={`Quick add ${exercise.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Quick Add
              </span>
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-primary-foreground/90">
                <Zap className="h-3.5 w-3.5" />
                <TrendingUp className="h-3.5 w-3.5" />
                <Target className="h-3.5 w-3.5" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
