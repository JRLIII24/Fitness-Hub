"use client";

import { Y2K } from "@/lib/pods/y2k-tokens";

/** Fixed-position star-field dot-grid overlay for the Pods zone. Sits above ambient blobs, below all content. */
export function StarGrid() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: Y2K.gridBg,
        backgroundSize: Y2K.gridSize,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

/** @deprecated Use StarGrid instead */
export const TacticalGrid = StarGrid;
