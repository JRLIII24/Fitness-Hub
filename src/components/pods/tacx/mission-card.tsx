"use client";

import { motion } from "framer-motion";
import { Y2K, getInitials } from "@/lib/pods/y2k-tokens";
import type { PodChallenge, LeaderboardEntry } from "@/types/pods";
import { Panel } from "./panel";
import { RankNum } from "./rank-num";
import { Dumbbell, Flame, Clock } from "lucide-react";

interface QuestCardProps {
  challenge: PodChallenge;
  entries?: LeaderboardEntry[];
  isActive: boolean;
  daysLeft?: number;
  index?: number;
}

export function QuestCard({
  challenge,
  entries = [],
  isActive,
  daysLeft,
  index = 0,
}: QuestCardProps) {
  const isVolume = challenge.challenge_type === "volume";
  const accent = isActive ? Y2K.cyan : Y2K.borderAcc;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * Y2K.stagger, ...Y2K.spring }}
    >
      <Panel accent={accent}>
        {/* Header */}
        <div className="flex items-start justify-between" style={{ marginBottom: "8px" }}>
          <div>
            {/* Live indicator */}
            {isActive && (
              <div
                className="flex items-center gap-1"
                style={{ marginBottom: "4px" }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: Y2K.cyan,
                    animation: "pulse-dot 1.8s ease-in-out infinite",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: Y2K.cyan,
                  }}
                >
                  QUEST LIVE
                </span>
              </div>
            )}

            {/* Quest name */}
            <h3
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "16px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: Y2K.text1,
                margin: 0,
              }}
            >
              {challenge.name}
            </h3>

            {/* Type + date range */}
            <div className="flex items-center gap-2" style={{ marginTop: "2px" }}>
              {isVolume ? (
                <Dumbbell size={10} style={{ color: Y2K.text2 }} />
              ) : (
                <Flame size={10} style={{ color: Y2K.text2 }} />
              )}
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: Y2K.text2,
                }}
              >
                {isVolume ? "VOLUME" : "CONSISTENCY"} · {formatDateShort(challenge.start_date)} – {formatDateShort(challenge.end_date)}
              </span>
            </div>
          </div>

          {/* Countdown */}
          {isActive && daysLeft !== undefined && (
            <div
              className="flex flex-col items-center"
              style={{
                padding: "4px 10px",
                border: `1px solid ${Y2K.cyanBorder}`,
                borderRadius: Y2K.r16,
                background: Y2K.cyanBg,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "20px",
                  fontWeight: 900,
                  color: Y2K.cyan,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {daysLeft}
              </span>
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "7px",
                  fontWeight: 900,
                  letterSpacing: "0.10em",
                  color: Y2K.cyanDim,
                  marginTop: "1px",
                }}
              >
                DAYS
              </span>
            </div>
          )}

          {!isActive && (
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "8px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                color: Y2K.text3,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${Y2K.border1}`,
                borderRadius: Y2K.rFull,
                padding: "2px 6px",
              }}
            >
              COMPLETED
            </span>
          )}
        </div>

        {/* Mini scoreboard */}
        {entries.length > 0 && (
          <div
            style={{
              borderTop: `1px solid ${Y2K.border1}`,
              paddingTop: "6px",
            }}
          >
            {entries.slice(0, 5).map((entry, i) => (
              <div
                key={entry.user_id}
                className="flex items-center gap-2"
                style={{
                  padding: "3px 0",
                }}
              >
                <RankNum rank={entry.rank} />
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: Y2K.rFull,
                    background: `${Y2K.rank[entry.rank] || Y2K.text2}15`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "8px",
                      fontWeight: 900,
                      color: Y2K.rank[entry.rank] || Y2K.text2,
                    }}
                  >
                    {getInitials(entry.display_name)}
                  </span>
                </div>
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    color: Y2K.text1,
                  }}
                >
                  {entry.display_name || "PLAYER"}
                </span>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "12px",
                    fontWeight: 900,
                    color: Y2K.text1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isVolume
                    ? `${(entry.score / 1000).toFixed(1)}T`
                    : `${entry.score} SESS`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </motion.div>
  );
}

/** @deprecated Use QuestCard instead */
export const MissionCard = QuestCard;

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
