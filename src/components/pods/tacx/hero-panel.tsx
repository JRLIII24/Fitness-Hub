"use client";

import { type CSSProperties, type ReactNode } from "react";
import { Y2K, tierCfg, type TierConfig } from "@/lib/pods/y2k-tokens";
import type { ArenaTier } from "@/types/pods";

interface HeroPanelProps {
  children: ReactNode;
  tier: ArenaTier;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
}

export function HeroPanel({
  children,
  tier,
  style,
  onClick,
  className,
}: HeroPanelProps) {
  const tc = tierCfg(tier);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`rounded-3xl ${className || ""}`}
      style={{
        position: "relative",
        background: Y2K.bg2,
        border: `1px solid ${tc.border}`,
        borderTop: `2px solid ${tc.fg}`,
        borderLeft: `2px solid ${tc.fg}`,
        boxShadow: tc.glow,
        padding: "16px",
        overflow: "hidden",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
