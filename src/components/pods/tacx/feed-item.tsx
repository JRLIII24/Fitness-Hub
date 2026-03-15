"use client";

import { Y2K, getInitials } from "@/lib/pods/y2k-tokens";
import { Sparkles } from "lucide-react";

interface FeedItemProps {
  senderName: string | null;
  senderColor?: string;
  recipientName?: string | null;
  body: string;
  timestamp: string;
  isSystem?: boolean;
  pts?: number;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function FeedItem({
  senderName,
  senderColor,
  recipientName,
  body,
  timestamp,
  isSystem,
  pts,
}: FeedItemProps) {
  if (isSystem) {
    return (
      <div
        className="flex items-start gap-2"
        style={{
          padding: "8px",
          borderLeft: `3px solid ${Y2K.cyan}`,
          background: Y2K.cyanBg,
          borderRadius: Y2K.r12,
        }}
      >
        <Sparkles size={12} style={{ color: Y2K.cyan, marginTop: "2px", flexShrink: 0 }} />
        <div className="flex-1">
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "10px",
              fontWeight: 900,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: Y2K.cyan,
            }}
          >
            {body}
          </span>
        </div>
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {pts && (
            <span
              style={{
                fontFamily: Y2K.fontDisplay,
                fontSize: "8px",
                fontWeight: 900,
                color: Y2K.cyan,
                background: Y2K.cyanBg,
                border: `1px solid ${Y2K.cyanBorder}`,
                borderRadius: Y2K.rFull,
                padding: "1px 4px",
              }}
            >
              +{pts} PTS
            </span>
          )}
          <span
            style={{
              fontFamily: Y2K.fontSans,
              fontSize: "9px",
              color: Y2K.text3,
            }}
          >
            {relativeTime(timestamp)}
          </span>
        </div>
      </div>
    );
  }

  const initials = getInitials(senderName);
  const color = senderColor || Y2K.text2;

  return (
    <div className="flex items-start gap-2" style={{ padding: "6px 0" }}>
      {/* Avatar */}
      <div
        className="flex items-center justify-center"
        style={{
          width: "26px",
          height: "26px",
          borderRadius: Y2K.rFull,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: Y2K.fontDisplay,
            fontSize: "9px",
            fontWeight: 900,
            color,
          }}
        >
          {initials}
        </span>
      </div>

      {/* Bubble */}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div
          className="flex items-center gap-1"
          style={{ marginBottom: "2px" }}
        >
          <span
            style={{
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: Y2K.text1,
            }}
          >
            {senderName || "UNKNOWN"}
          </span>
          {recipientName && (
            <>
              <span style={{ color: Y2K.text3, fontSize: "8px" }}>&rarr;</span>
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: Y2K.text2,
                }}
              >
                {recipientName}
              </span>
            </>
          )}
        </div>
        <p
          style={{
            fontFamily: Y2K.fontSans,
            fontSize: "12px",
            fontWeight: 400,
            color: Y2K.text2,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {body}
        </p>
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontFamily: Y2K.fontSans,
          fontSize: "9px",
          color: Y2K.text3,
          flexShrink: 0,
        }}
      >
        {relativeTime(timestamp)}
      </span>
    </div>
  );
}
