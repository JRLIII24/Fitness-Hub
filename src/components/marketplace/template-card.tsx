"use client";

import { motion } from "framer-motion";
import { Bookmark, Dumbbell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMuscleColor } from "./muscle-colors";
import { getDifficultyInfo } from "@/lib/template-utils";
import { StarRatingInput } from "./star-rating-input";
import type { PublicTemplate } from "@/types/pods";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ── component ─────────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: PublicTemplate;
  isSaved: boolean;
  onSave: (e: React.MouseEvent) => void;
  onPreview: () => void;
  currentUserId?: string;
}

export function TemplateCard({ template, isSaved, onSave, onPreview, currentUserId }: TemplateCardProps) {
  const exercises = template.template_exercises ?? [];
  // Prefer the explicit category set at publish time; fall back to first exercise group
  const primaryGroup = template.primary_muscle_group
    ?? exercises[0]?.exercises?.muscle_group
    ?? "full body";
  const gc = getMuscleColor(primaryGroup);
  const diff = getDifficultyInfo(template.difficulty_level ?? "grind");
  const creatorName = template.creator?.display_name ?? "Unknown";
  const saveCount = template.save_count ?? 0;
  const isOwn = !!currentUserId && template.user_id === currentUserId;

  const totalSets = exercises.reduce((s, e) => s + (e.target_sets ?? 0), 0);

  // Unique muscle groups (no cap — render shows 2 + "+N" overflow)
  const muscleGroups = [
    ...new Set(exercises.map(te => te.exercises?.muscle_group).filter(Boolean) as string[]),
  ];

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onPreview}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-card/30 transition-colors hover:border-border/80"
    >
      {/* ── Gradient header ─────────────────────────────────────────────── */}
      <div
        className="relative h-[64px]"
        style={{ background: `linear-gradient(135deg, ${gc.from}CC, ${gc.to}99)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />

        {/* Category label — bottom-left when tall */}
        <span
          className="absolute left-2 bottom-2 rounded-full px-2 py-0.5 text-[9px] font-bold capitalize backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.40)", color: gc.labelColor }}
        >
          {primaryGroup.replace(/_/g, " ")}
        </span>

        {/* "Yours" badge */}
        {isOwn && (
          <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white/70 backdrop-blur-sm">
            Yours
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3.5 pt-2.5">
        {/* Difficulty pill */}
        <span
          className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{ background: diff.bg, color: diff.color }}
        >
          {diff.label}
        </span>

        {/* Template name */}
        <p className="mb-1.5 line-clamp-2 text-[13px] font-black leading-tight tracking-tight text-foreground">
          {template.name}
        </p>

        {/* Exercise + sets summary */}
        <p className="mb-2 text-[11px] text-muted-foreground">
          {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
          {totalSets > 0 && ` · ${totalSets} sets`}
        </p>

        {/* Author row */}
        <div className="mb-2.5 flex items-center gap-1.5">
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
            style={{
              background: gc.bgAlpha,
              border: `1px solid ${gc.borderAlpha}`,
              color: gc.labelColor,
            }}
          >
            {initials(template.creator?.display_name)}
          </div>
          <span className="truncate text-[11px] text-muted-foreground">{creatorName}</span>
        </div>

        {/* Muscle group tags */}
        {muscleGroups.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1">
            {muscleGroups.slice(0, 2).map(g => {
              const mgc = getMuscleColor(g);
              return (
                <span
                  key={g}
                  className="rounded-full px-[6px] py-[2px] text-[10px] font-semibold"
                  style={{ background: mgc.bgAlpha, color: mgc.labelColor, border: `1px solid ${mgc.borderAlpha}` }}
                >
                  {g}
                </span>
              );
            })}
            {muscleGroups.length > 2 && (
              <span className="rounded-full bg-card/60 px-[6px] py-[2px] text-[10px] text-muted-foreground">
                +{muscleGroups.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Bookmark className="h-2.5 w-2.5 text-muted-foreground" />
            <span className={cn("tabular-nums text-[10px] text-muted-foreground")}>
              {saveCount >= 1000 ? `${(saveCount / 1000).toFixed(1)}k` : saveCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="tabular-nums text-[10px] text-muted-foreground">{exercises.length}</span>
          </div>
          {/* Star rating — shown only when reviews exist */}
          {(template.review_count ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <StarRatingInput value={template.avg_rating ?? 0} readonly size="sm" />
              <span className="tabular-nums text-[10px] text-muted-foreground">
                ({template.review_count})
              </span>
            </div>
          )}
          {template.estimated_duration_min && (template.review_count ?? 0) === 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {template.estimated_duration_min}m
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

export function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
      <div className="h-[48px] animate-pulse bg-card/70" />
      <div className="px-3 pb-3.5 pt-2.5">
        <div className="mb-1.5 h-3 w-12 animate-pulse rounded-full bg-card/70" />
        <div className="mb-1.5 h-3.5 w-4/5 animate-pulse rounded bg-card/70" />
        <div className="mb-2 h-3 w-1/3 animate-pulse rounded bg-card/70" />
        <div className="mb-2.5 h-3 w-1/2 animate-pulse rounded bg-card/70" />
        <div className="mb-2.5 flex gap-1.5">
          <div className="h-4 w-12 animate-pulse rounded-full bg-card/70" />
          <div className="h-4 w-10 animate-pulse rounded-full bg-card/70" />
        </div>
        <div className="h-2.5 w-2/3 animate-pulse rounded bg-card/70" />
      </div>
    </div>
  );
}
