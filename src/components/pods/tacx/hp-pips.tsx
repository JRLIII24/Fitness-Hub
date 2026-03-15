"use client";

import { motion } from "framer-motion";
import { Y2K, statusCfg, type PlayerStatus } from "@/lib/pods/y2k-tokens";

interface HpPipsProps {
  current: number;   // Sessions completed
  max: number;       // Weekly goal
  status: PlayerStatus;
}

export function HpPips({ current, max, status }: HpPipsProps) {
  const sc = statusCfg(status);
  const count = Math.max(max, 1);

  return (
    <div className="flex gap-1">
      {Array.from({ length: count }, (_, i) => {
        const filled = i < current;
        return (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * Y2K.stagger, duration: 0.25 }}
            style={{
              width: "100%",
              maxWidth: "28px",
              height: "10px",
              borderRadius: Y2K.rFull,
              background: filled ? sc.fg : "rgba(255,255,255,0.06)",
              border: filled
                ? `1px solid ${sc.fg}`
                : `1px solid ${Y2K.border1}`,
              boxShadow: filled ? `0 0 6px ${sc.fg}40` : undefined,
              transformOrigin: "bottom",
            }}
          />
        );
      })}
    </div>
  );
}
