"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Y2K, tierCfg, getInitials } from "@/lib/pods/y2k-tokens";
import type { ArenaTier } from "@/types/pods";
import { createClient } from "@/lib/supabase/client";
import { Panel } from "./panel";
import { Sparkles, Star, ChevronDown, Loader2 } from "lucide-react";

interface RecapCardProps {
  podId: string;
  tier: ArenaTier;
  mvpName?: string | null;
}

interface SeasonRecap {
  id: string;
  summary: string;
  highlights: string[];
  recap_date: string;
  mvp_user_id: string | null;
}

export function RecapCard({ podId, tier, mvpName }: RecapCardProps) {
  const [recap, setRecap] = useState<SeasonRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const tc = tierCfg(tier);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("pod_season_recaps")
        .select("id, summary, highlights, recap_date, mvp_user_id")
        .eq("pod_id", podId)
        .order("recap_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setRecap({
          id: data.id,
          summary: data.summary,
          highlights: Array.isArray(data.highlights) ? (data.highlights as string[]) : [],
          recap_date: data.recap_date,
          mvp_user_id: data.mvp_user_id,
        });
      }
      if (!cancelled) setLoading(false);
    }
    fetch();
    return () => { cancelled = true; };
  }, [podId, supabase]);

  if (loading) {
    return (
      <Panel accent="rgba(183,148,246,0.50)">
        <div className="flex justify-center" style={{ padding: "16px" }}>
          <Loader2 size={16} style={{ color: Y2K.text3, animation: "spin 1s linear infinite" }} />
        </div>
      </Panel>
    );
  }

  if (!recap) {
    return (
      <Panel accent="rgba(183,148,246,0.30)">
        <div className="flex items-center gap-2" style={{ padding: "4px 0" }}>
          <Sparkles size={12} style={{ color: Y2K.lavender }} />
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: Y2K.lavender,
            }}
          >
            FIRST SEASON RECAP PENDING
          </span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel accent="rgba(183,148,246,0.50)">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <div className="flex items-center gap-2">
          <Sparkles size={12} style={{ color: Y2K.lavender }} />
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: Y2K.lavender,
            }}
          >
            SEASON RECAP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "7px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: Y2K.text3,
              textTransform: "uppercase",
            }}
          >
            AI RECAP ·{" "}
            {new Date(recap.recap_date).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }).toUpperCase()}
          </span>
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "7px",
              fontWeight: 900,
              letterSpacing: "0.10em",
              background: "rgba(183,148,246,0.12)",
              border: "1px solid rgba(183,148,246,0.25)",
              borderRadius: Y2K.rFull,
              padding: "1px 4px",
              color: Y2K.lavender,
            }}
          >
            FINAL
          </span>
        </div>
      </div>

      {/* Summary */}
      <p
        style={{
          fontFamily: Y2K.fontSans,
          fontSize: "12px",
          fontWeight: 400,
          color: Y2K.text2,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {recap.summary}
      </p>

      {/* Expand toggle */}
      {recap.highlights.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1"
          style={{
            marginTop: "8px",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: Y2K.fontDisplay,
            fontSize: "8px",
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: Y2K.lavender,
          }}
        >
          {expanded ? "HIDE RECAP" : "VIEW FULL RECAP"}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "inline-flex" }}
          >
            <ChevronDown size={10} />
          </motion.span>
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            {/* Highlights */}
            <div style={{ marginTop: "10px" }}>
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.text3,
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                HIGHLIGHTS
              </span>
              {recap.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2"
                  style={{
                    padding: "4px 6px",
                    borderLeft: "2px solid rgba(183,148,246,0.30)",
                    marginBottom: "4px",
                  }}
                >
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
                </div>
              ))}
            </div>

            {/* MVP */}
            {mvpName && (
              <div
                className="flex items-center gap-2"
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  borderRadius: Y2K.r16,
                  background: "rgba(192,132,252,0.06)",
                  border: "1px solid rgba(192,132,252,0.20)",
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: Y2K.rFull,
                    background: "rgba(192,132,252,0.15)",
                    border: "1px solid rgba(192,132,252,0.30)",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "10px",
                      fontWeight: 900,
                      color: "#C084FC",
                    }}
                  >
                    {getInitials(mvpName)}
                  </span>
                  <Star
                    size={10}
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      color: "#C084FC",
                    }}
                    strokeWidth={2.5}
                  />
                </div>
                <div>
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "7px",
                      fontWeight: 900,
                      letterSpacing: "0.10em",
                      color: "#C084FC",
                      display: "block",
                    }}
                  >
                    MVP PLAYER
                  </span>
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "13px",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      color: Y2K.text1,
                    }}
                  >
                    {mvpName}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

/** @deprecated Use RecapCard instead */
export const AARCard = RecapCard;
