"use client";

import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import { Label } from "@/components/ui/label";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";

interface QuickStartPanelProps {
  presetId: WorkoutPresetId;
  quickFilter: string;
  onQuickFilterChange: (filter: string) => void;
  onPresetChange: (id: WorkoutPresetId) => void;
}

export function QuickStartPanel({
  presetId,
  quickFilter,
  onQuickFilterChange,
  onPresetChange,
}: QuickStartPanelProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <Label
        htmlFor="preset"
        className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
      >
        Choose a Preset
      </Label>

      {/* Marketplace-style filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {MUSCLE_FILTERS.map((f) => {
          const on = quickFilter === f;
          const mgc = f !== "All" ? getMuscleColor(f) : null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onQuickFilterChange(f)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-150"
              style={{
                background: on
                  ? (mgc ? mgc.bgAlpha : "rgba(200,255,0,0.15)")
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${on
                  ? (mgc ? mgc.borderAlpha : "rgba(200,255,0,0.4)")
                  : "rgba(255,255,255,0.08)"}`,
                color: on
                  ? (mgc ? mgc.labelColor : "hsl(var(--primary))")
                  : "hsl(var(--muted-foreground))",
                fontWeight: on ? 700 : 500,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Filtered preset grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POPULAR_WORKOUTS
          .filter((preset) => quickFilter === "All" || preset.category.toLowerCase() === quickFilter.toLowerCase())
          .map((preset) => {
            const gc = getMuscleColor(preset.category);
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetChange(preset.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70 hover:bg-card"
                  }`}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-semibold leading-snug">{preset.defaultName}</p>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                    style={{
                      background: gc.bgAlpha,
                      color: gc.labelColor,
                      border: `1px solid ${gc.borderAlpha}`,
                    }}
                  >
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {preset.liftNames.length} exercises
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {preset.liftNames.slice(0, 2).map((lift) => (
                    <p key={lift} className="truncate text-[10px] text-muted-foreground/90">
                      {"\u2022"} {lift}
                    </p>
                  ))}
                  {preset.liftNames.length > 2 ? (
                    <p className="text-[10px] text-muted-foreground/80">
                      +{preset.liftNames.length - 2} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        <button
          type="button"
          onClick={() => onPresetChange("custom")}
          className={`rounded-xl border px-3 py-2 text-left transition ${presetId === "custom"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-xs font-semibold">Custom</p>
          <p className="text-[10px] text-muted-foreground">Start empty workout</p>
        </button>
      </div>
    </div>
  );
}
