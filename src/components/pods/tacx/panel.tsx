"use client";

import { type CSSProperties, type ReactNode } from "react";
import { Y2K } from "@/lib/pods/y2k-tokens";

interface PanelProps {
  children: ReactNode;
  accent?: string;        // Hex color for 2px top border
  noPad?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;     // Tailwind layout classes only
}

export function Panel({
  children,
  accent,
  noPad,
  style,
  onClick,
  className,
}: PanelProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={className}
      style={{
        position: "relative",
        background: Y2K.bg1,
        border: `1px solid ${Y2K.border1}`,
        borderTop: accent
          ? `2px solid ${accent}`
          : `1px solid ${Y2K.border1}`,
        borderRadius: Y2K.r16,
        padding: noPad ? 0 : "12px",
        overflow: "hidden",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
