"use client";

import { Y2K, statusCfg, type PlayerStatus } from "@/lib/pods/y2k-tokens";
import {
  Sparkles,
  Clock,
  Ghost,
  Zap,
  Dumbbell,
} from "lucide-react";

const iconMap = {
  active: Sparkles,
  warning: Clock,
  critical: Ghost,
  clutch: Zap,
  training: Dumbbell,
} as const;

interface StatusBadgeProps {
  status: PlayerStatus;
  mini?: boolean;
}

export function StatusBadge({ status, mini }: StatusBadgeProps) {
  const sc = statusCfg(status);
  const Icon = iconMap[status];
  const size = mini ? 8 : 10;

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: sc.bg,
        border: `1px solid ${sc.border}`,
        borderRadius: Y2K.rFull,
        padding: mini ? "1px 4px" : "2px 6px",
        color: sc.fg,
        fontFamily: Y2K.fontDisplay,
        fontSize: mini ? "7px" : "9px",
        fontWeight: 900,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {(status === "active" || status === "training") && (
        <span
          style={{
            width: size - 2,
            height: size - 2,
            borderRadius: "50%",
            background: sc.fg,
            animation: "pulse-dot 1.8s ease-in-out infinite",
          }}
        />
      )}
      {status !== "active" && status !== "training" && <Icon size={size} strokeWidth={2.5} />}
      {sc.label}
    </span>
  );
}
