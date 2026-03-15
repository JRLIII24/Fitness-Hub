"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Moon } from "lucide-react";
import { Y2K, getPlayerStatus, statusCfg, tierCfg, getInitials, formatVolume } from "@/lib/pods/y2k-tokens";
import type { MemberProgress, ArenaTier } from "@/types/pods";
import { Panel } from "./panel";
import { StatusBadge } from "./status-badge";
import { HpPips } from "./hp-pips";
import { WeekDots } from "./week-dots";
import { Flame, Zap } from "lucide-react";

function isMemberRestDay(preferredDays?: number[] | null): boolean {
  if (!preferredDays || preferredDays.length === 0) return false;
  return !preferredDays.includes(new Date().getDay());
}

interface PlayerCardProps {
  progress: MemberProgress;
  tier: ArenaTier;
  isCurrentUser?: boolean;
  index?: number;       // For stagger animation
  onComms?: () => void; // Opens SendMessage targeted at this player
  isTraining?: boolean;
  workoutName?: string;
  workoutStartedAt?: string;
}

export function PlayerCard({
  progress,
  tier,
  isCurrentUser,
  index = 0,
  onComms,
  isTraining,
  workoutName,
  workoutStartedAt,
}: PlayerCardProps) {
  const restDay = isMemberRestDay(progress.preferred_workout_days);
  const weeklyStatus = getPlayerStatus(progress);
  const status = isTraining ? "training" as const : weeklyStatus;
  const sc = statusCfg(status);
  const tc = tierCfg(tier);
  const initials = getInitials(progress.display_name || progress.username);
  const name = progress.display_name || progress.username || "PLAYER";

  // Live elapsed time for training players
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!isTraining || !workoutStartedAt) return;
    const update = () => {
      const mins = Math.floor((Date.now() - new Date(workoutStartedAt).getTime()) / 60000);
      setElapsed(mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    update();
    const id = setInterval(update, 30000); // update every 30s
    return () => clearInterval(id);
  }, [isTraining, workoutStartedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * Y2K.stagger, ...Y2K.spring }}
    >
      <Panel accent={isCurrentUser ? tc.fg : sc.fg}>
        {/* Header row */}
        <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
          {/* Avatar */}
          <div
            className="flex items-center justify-center"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: Y2K.rFull,
              background: `${sc.fg}18`,
              border: `1px solid ${sc.fg}30`,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "12px",
                fontWeight: 900,
                color: sc.fg,
              }}
            >
              {initials}
            </span>
          </div>

          {/* Name + handle */}
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="flex items-center gap-1">
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "15px",
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: Y2K.text1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              {isCurrentUser && (
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "7px",
                    fontWeight: 900,
                    letterSpacing: "0.10em",
                    color: Y2K.text3,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${Y2K.border1}`,
                    borderRadius: Y2K.rFull,
                    padding: "1px 4px",
                  }}
                >
                  YOU
                </span>
              )}
            </div>
            {isTraining ? (
              <div className="flex items-center gap-1">
                <Dumbbell size={10} style={{ color: Y2K.cyan }} />
                <span
                  style={{
                    fontFamily: Y2K.fontSans,
                    fontSize: "10px",
                    fontWeight: 600,
                    color: Y2K.cyan,
                  }}
                >
                  {workoutName || "Working out"}{elapsed ? ` · ${elapsed}` : ""}
                </span>
              </div>
            ) : progress.username ? (
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: Y2K.text3,
                }}
              >
                @{progress.username}
              </span>
            ) : null}
          </div>

          {/* Status badge */}
          {restDay && !isTraining ? (
            <span
              className="inline-flex items-center gap-1"
              style={{
                background: "rgba(52,211,153,0.10)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: Y2K.rFull,
                padding: "2px 6px",
                color: "#34D399",
                fontFamily: Y2K.fontDisplay,
                fontSize: "9px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              <Moon size={10} strokeWidth={2.5} />
              REST DAY
            </span>
          ) : (
            <StatusBadge status={status} />
          )}

          {/* Message button */}
          {!isCurrentUser && onComms && (
            <button
              onClick={(e) => { e.stopPropagation(); onComms(); }}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: Y2K.rFull,
                background: Y2K.cyanBg,
                border: `1px solid ${Y2K.cyanBorder}`,
                color: Y2K.cyan,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Zap size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* HP bar + count */}
        <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "8px",
              fontWeight: 900,
              letterSpacing: "0.10em",
              color: Y2K.text3,
              width: "16px",
              textAlign: "right",
            }}
          >
            HP
          </span>
          <div className="flex-1">
            <HpPips current={progress.completed} max={progress.commitment || 1} status={status} />
          </div>
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "12px",
              fontWeight: 900,
              color: Y2K.text1,
              fontVariantNumeric: "tabular-nums",
              minWidth: "32px",
              textAlign: "right",
            }}
          >
            {progress.completed}
            <span style={{ color: Y2K.text3 }}>/{progress.commitment || "\u2013"}</span>
          </span>
        </div>

        {/* Week dots */}
        <div style={{ marginBottom: "8px" }}>
          <WeekDots
            plannedDays={progress.planned_days}
            completedDays={progress.completed_days}
          />
        </div>

        {/* Stats row */}
        <div
          className="flex"
          style={{
            borderTop: `1px solid ${Y2K.border1}`,
            paddingTop: "6px",
            gap: "2px",
          }}
        >
          <StatCell label="SESSIONS" value={String(progress.completed)} />
          <StatCell label="VOLUME" value={formatVolume(progress.volume_kg)} />
          <StatCell
            label="STREAK"
            value={progress.streak > 0 ? `${progress.streak}WK` : "\u2013"}
            icon={progress.streak >= 4 ? "flame" : undefined}
            highlight={progress.streak >= 4}
          />
        </div>
      </Panel>
    </motion.div>
  );
}

/** @deprecated Use PlayerCard instead */
export const OperatorCard = PlayerCard;

function StatCell({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: "flame";
  highlight?: boolean;
}) {
  return (
    <div
      className="flex-1 flex flex-col items-center"
      style={{
        padding: "4px 2px",
        borderRadius: Y2K.r12,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-center gap-0.5">
        {icon === "flame" && (
          <Flame size={10} style={{ color: "#FF9500" }} strokeWidth={2.5} />
        )}
        <span
          style={{
            fontFamily: Y2K.fontDisplay,
            fontSize: "14px",
            fontWeight: 900,
            color: highlight ? "#FF9500" : Y2K.text1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontFamily: Y2K.fontDisplay,
          fontSize: "7px",
          fontWeight: 900,
          letterSpacing: "0.10em",
          color: Y2K.text3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}
