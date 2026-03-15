"use client";

import { Y2K, tierCfg } from "@/lib/pods/y2k-tokens";
import type { ArenaTier } from "@/types/pods";
import { Sparkles } from "lucide-react";

interface TierBadgeProps {
  tier: ArenaTier;
  score?: number;
  compact?: boolean;
}

export function TierBadge({ tier, score, compact }: TierBadgeProps) {
  const tc = tierCfg(tier);

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: tc.bg,
        border: `1px solid ${tc.border}`,
        borderRadius: Y2K.rFull,
        padding: compact ? "1px 4px" : "2px 8px",
        color: tc.fg,
        fontFamily: Y2K.fontDisplay,
        fontSize: compact ? "8px" : "10px",
        fontWeight: 900,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <Sparkles size={compact ? 8 : 10} strokeWidth={2.5} />
      {tier}
      {score !== undefined && (
        <span style={{ fontVariantNumeric: "tabular-nums", marginLeft: "2px" }}>
          {score}
        </span>
      )}
    </span>
  );
}

/** @deprecated Use TierBadge instead */
export const DivBadge = TierBadge;
