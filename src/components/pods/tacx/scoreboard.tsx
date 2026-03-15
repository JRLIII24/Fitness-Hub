"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Y2K, tierCfg, getInitials } from "@/lib/pods/y2k-tokens";
import { getArenaTier, ARENA_TIERS } from "@/types/pods";
import type { ArenaTier, ChallengeLeaderboard, LeaderboardEntry } from "@/types/pods";
import { usePodLeaderboard } from "@/hooks/use-pod-leaderboard";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { POD_ARENA_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/client";
import { Panel } from "./panel";
import { Y2KTabs } from "./tabs";
import { RankNum } from "./rank-num";
import { TierBadge } from "./div-badge";
import { Sparkles, Loader2 } from "lucide-react";

type ScoreboardTab = "volume" | "consistency" | "arena";

interface ScoreboardProps {
  podId: string;
  tier: ArenaTier;
  seasonScore?: number;
  seasonStartDate?: string;
}

export function Scoreboard({
  podId,
  tier,
  seasonScore,
  seasonStartDate,
}: ScoreboardProps) {
  const { leaderboards, loading, error } = usePodLeaderboard(podId);
  const unitPref = useUnitPreferenceStore((s) => s.preference);
  const showArena = POD_ARENA_ENABLED && seasonScore !== undefined;

  const [activeTab, setActiveTab] = useState<ScoreboardTab>("volume");
  const tc = tierCfg(tier);

  const tabs = [
    { id: "volume" as const, label: "VOLUME" },
    { id: "consistency" as const, label: "CONSISTENCY" },
    ...(showArena ? [{ id: "arena" as const, label: "ARENA" }] : []),
  ];

  if (loading) {
    return (
      <Panel accent={tc.fg}>
        <div className="flex items-center justify-center" style={{ padding: "32px 0" }}>
          <Loader2 size={20} style={{ color: Y2K.text2, animation: "spin 1s linear infinite" }} />
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel accent={Y2K.status.critical.fg}>
        <p style={{ fontFamily: Y2K.fontSans, fontSize: "12px", color: Y2K.text2, textAlign: "center", padding: "16px" }}>
          {error}
        </p>
      </Panel>
    );
  }

  return (
    <Panel accent={tc.fg} noPad>
      <div style={{ padding: "12px 12px 8px" }}>
        <Y2KTabs tabs={tabs} active={activeTab} onChange={setActiveTab} accent={tc.fg} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ padding: "0 12px 12px" }}
        >
          {activeTab === "arena" && showArena ? (
            <ArenaContent
              podId={podId}
              tier={tier}
              seasonScore={seasonScore!}
              seasonStartDate={seasonStartDate}
            />
          ) : (
            <LeaderboardContent
              leaderboard={
                activeTab === "volume"
                  ? leaderboards.volume
                  : leaderboards.consistency
              }
              unit={activeTab === "volume" ? "kg" : "sessions"}
              unitPref={unitPref}
              tier={tier}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}

// ── Leaderboard rows ──────────────────────────────────────────────────────────

function LeaderboardContent({
  leaderboard,
  unit,
  unitPref,
  tier,
}: {
  leaderboard: ChallengeLeaderboard | null;
  unit: "kg" | "sessions";
  unitPref: "metric" | "imperial";
  tier: ArenaTier;
}) {
  if (!leaderboard?.entries?.length) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          padding: "24px 0",
          border: `1px dashed ${Y2K.border1}`,
          borderRadius: Y2K.r16,
        }}
      >
        <Sparkles size={16} style={{ color: Y2K.text3, marginBottom: "8px" }} />
        <p style={{ fontFamily: Y2K.fontSans, fontSize: "11px", color: Y2K.text3 }}>
          No active challenge data
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...leaderboard.entries.map((e) => e.score), 1);

  return (
    <div className="flex flex-col gap-1">
      {leaderboard.entries.map((entry, i) => {
        const isImperial = unitPref === "imperial" && unit === "kg";
        const score = isImperial ? kgToLbs(entry.score) : entry.score;
        const displayUnit = isImperial ? "lbs" : unit;
        const formatted =
          unit === "kg"
            ? `${Math.round(score).toLocaleString()} ${displayUnit.toUpperCase()}`
            : `${entry.score} SESS`;
        const barWidth = (entry.score / maxScore) * 100;
        const rankColor = Y2K.rank[entry.rank] || Y2K.text2;

        return (
          <motion.div
            key={entry.user_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * Y2K.stagger, ...Y2K.spring }}
            className="flex items-center gap-2"
            style={{
              padding: "6px 8px",
              borderRadius: Y2K.r12,
              background:
                entry.rank <= 3
                  ? `${rankColor}08`
                  : "transparent",
              borderLeft:
                entry.rank <= 3
                  ? `3px solid ${rankColor}`
                  : "3px solid transparent",
            }}
          >
            <RankNum rank={entry.rank} />

            {/* Avatar */}
            <div
              className="flex items-center justify-center"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: Y2K.rFull,
                background: `${rankColor}15`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  color: rankColor,
                }}
              >
                {getInitials(entry.display_name)}
              </span>
            </div>

            {/* Name + bar */}
            <div className="flex-1" style={{ minWidth: 0 }}>
              <span
                className="block truncate"
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "11px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: Y2K.text1,
                  marginBottom: "2px",
                }}
              >
                {entry.display_name || "PLAYER"}
              </span>
              {/* Progress bar */}
              <div
                style={{
                  height: "3px",
                  borderRadius: "1.5px",
                  background: Y2K.border1,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    height: "100%",
                    background: rankColor,
                    borderRadius: "1.5px",
                    boxShadow:
                      entry.rank === 1
                        ? `0 0 6px ${rankColor}60`
                        : undefined,
                  }}
                />
              </div>
            </div>

            {/* Score */}
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "12px",
                fontWeight: 900,
                color: Y2K.text1,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {formatted}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Arena tab ─────────────────────────────────────────────────────────────────

interface SeasonRecap {
  id: string;
  summary: string;
  highlights: string[];
  recap_date: string;
}

function ArenaContent({
  podId,
  tier,
  seasonScore,
  seasonStartDate,
}: {
  podId: string;
  tier: ArenaTier;
  seasonScore: number;
  seasonStartDate?: string;
}) {
  const tc = tierCfg(tier);
  const tierInfo = ARENA_TIERS[tier];
  const nextThreshold = tierInfo.next;
  const progressPct =
    nextThreshold !== null
      ? Math.min(100, ((seasonScore - tierInfo.min) / (nextThreshold - tierInfo.min)) * 100)
      : 100;

  const [recap, setRecap] = useState<SeasonRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    async function fetchRecap() {
      setRecapLoading(true);
      const { data } = await supabase
        .from("pod_season_recaps")
        .select("id, summary, highlights, recap_date")
        .eq("pod_id", podId)
        .order("recap_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setRecap({
          id: data.id,
          summary: data.summary,
          highlights: Array.isArray(data.highlights)
            ? (data.highlights as string[])
            : [],
          recap_date: data.recap_date,
        });
      }
      if (!cancelled) setRecapLoading(false);
    }
    fetchRecap();
    return () => { cancelled = true; };
  }, [podId, supabase]);

  return (
    <div className="flex flex-col gap-3">
      {/* Tier display */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "12px",
          borderRadius: Y2K.r16,
          background: tc.bg,
          border: `1px solid ${tc.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: Y2K.rFull,
              background: `${tc.fg}20`,
              border: `1px solid ${tc.fg}40`,
            }}
          >
            <Sparkles size={18} style={{ color: tc.fg }} />
          </div>
          <div>
            <TierBadge tier={tier} />
            {seasonStartDate && (
              <p
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.text3,
                  marginTop: "2px",
                  textTransform: "uppercase",
                }}
              >
                SEASON STARTED{" "}
                {new Date(seasonStartDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontFamily: Y2K.fontDisplay,
            fontSize: "26px",
            fontWeight: 900,
            color: tc.fg,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            textShadow: tc.glow,
          }}
        >
          {seasonScore}
        </motion.span>
      </div>

      {/* Tier progress bar */}
      {nextThreshold !== null && (
        <div>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: Y2K.border1,
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                height: "100%",
                background: tc.fg,
                borderRadius: "2px",
              }}
            />
          </div>
          <div
            className="flex justify-between"
            style={{ marginTop: "4px" }}
          >
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
              {tierInfo.label}
            </span>
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "7px",
                fontWeight: 900,
                letterSpacing: "0.10em",
                color: Y2K.text3,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {seasonScore} / {nextThreshold}
            </span>
          </div>
        </div>
      )}

      {/* Season recap */}
      {recapLoading ? (
        <div className="flex justify-center" style={{ padding: "16px 0" }}>
          <Loader2 size={16} style={{ color: Y2K.text3, animation: "spin 1s linear infinite" }} />
        </div>
      ) : recap ? (
        <div
          style={{
            padding: "10px",
            borderRadius: Y2K.r16,
            border: `1px solid rgba(183,148,246,0.20)`,
            background: "rgba(183,148,246,0.05)",
          }}
        >
          <div className="flex items-center gap-1" style={{ marginBottom: "6px" }}>
            <Sparkles size={10} style={{ color: Y2K.lavender }} />
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "8px",
                fontWeight: 900,
                letterSpacing: "0.14em",
                color: Y2K.lavender,
                textTransform: "uppercase",
              }}
            >
              SEASON RECAP
            </span>
          </div>
          <p
            style={{
              fontFamily: Y2K.fontSans,
              fontSize: "12px",
              color: Y2K.text2,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {recap.summary}
          </p>
          {recap.highlights.length > 0 && (
            <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
              {recap.highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2"
                  style={{ padding: "2px 0" }}
                >
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: Y2K.lavender,
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: Y2K.fontSans,
                      fontSize: "11px",
                      color: Y2K.text2,
                      lineHeight: 1.4,
                    }}
                  >
                    {h}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            padding: "16px",
            border: `1px dashed ${Y2K.border1}`,
            borderRadius: Y2K.r16,
          }}
        >
          <Sparkles size={14} style={{ color: Y2K.text3, marginBottom: "6px" }} />
          <p style={{ fontFamily: Y2K.fontSans, fontSize: "11px", color: Y2K.text3, margin: 0 }}>
            First recap pending
          </p>
        </div>
      )}
    </div>
  );
}
