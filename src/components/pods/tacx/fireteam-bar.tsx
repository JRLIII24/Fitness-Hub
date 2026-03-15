"use client";

import { motion } from "framer-motion";
import {
  Y2K,
  getPlayerStatus,
  getCrewPressure,
  getInitials,
  statusCfg,
} from "@/lib/pods/y2k-tokens";
import type { MemberProgress } from "@/types/pods";

interface CrewBarProps {
  members: MemberProgress[];
  maxSlots?: number; // Default 8
}

const MAX_SLOTS = 8;

export function CrewBar({ members, maxSlots = MAX_SLOTS }: CrewBarProps) {
  const pressure = getCrewPressure(members);

  return (
    <div>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "6px" }}
      >
        <span
          style={{
            fontFamily: Y2K.fontDisplay,
            fontSize: "8px",
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: Y2K.text3,
          }}
        >
          CREW STATUS
        </span>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              color: pressure.color,
            }}
          >
            {pressure.label}
          </span>
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "18px",
              fontWeight: 900,
              color: pressure.color,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 12px ${pressure.color}40`,
            }}
          >
            {pressure.pct}%
          </span>
        </div>
      </div>

      {/* Segment bar */}
      <div className="flex gap-0.5" style={{ marginBottom: "4px" }}>
        {Array.from({ length: maxSlots }, (_, i) => {
          const member = members[i];
          const status = member ? getPlayerStatus(member) : null;
          const color = status ? statusCfg(status).fg : undefined;

          return (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              style={{
                flex: 1,
                height: "10px",
                borderRadius: Y2K.rFull,
                background: color || "rgba(255,255,255,0.03)",
                border: color
                  ? `1px solid ${color}50`
                  : `1px solid ${Y2K.border1}`,
                transformOrigin: "left",
              }}
            />
          );
        })}
      </div>

      {/* Player initials below segments */}
      <div className="flex gap-0.5">
        {Array.from({ length: maxSlots }, (_, i) => {
          const member = members[i];
          return (
            <div
              key={i}
              className="flex-1 flex justify-center"
            >
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "7px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: member ? Y2K.text2 : Y2K.text3,
                  textTransform: "uppercase",
                }}
              >
                {member ? getInitials(member.display_name || member.username) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use CrewBar instead */
export const FireteamBar = CrewBar;
