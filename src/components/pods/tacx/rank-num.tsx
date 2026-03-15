"use client";

import { Y2K } from "@/lib/pods/y2k-tokens";
import { Sparkles, Star, Trophy } from "lucide-react";

interface RankNumProps {
  rank: number;
}

export function RankNum({ rank }: RankNumProps) {
  const color = Y2K.rank[rank] || Y2K.text2;
  const iconSize = 12;

  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: "22px",
        height: "22px",
        borderRadius: Y2K.rFull,
        background:
          rank <= 3
            ? `${color}15`
            : "rgba(255,255,255,0.04)",
        border: rank <= 3
          ? `1px solid ${color}30`
          : `1px solid ${Y2K.border1}`,
        fontFamily: Y2K.fontDisplay,
        fontSize: "10px",
        fontWeight: 900,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {rank === 1 && <Sparkles size={iconSize} strokeWidth={2.5} />}
      {rank === 2 && <Star size={iconSize} strokeWidth={2.5} />}
      {rank === 3 && <Trophy size={iconSize} strokeWidth={2.5} />}
      {rank > 3 && String(rank).padStart(2, "0")}
    </div>
  );
}
