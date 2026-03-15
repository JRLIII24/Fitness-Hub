"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Y2K, getInitials, getPlayerStatus, statusCfg, tierCfg } from "@/lib/pods/y2k-tokens";
import type { MemberProgress, ArenaTier } from "@/types/pods";
import { X, Sparkles } from "lucide-react";

const QUICK_LINES = [
  "Let's gooo! \u{1F680}",
  "We need you! \u{1F4AA}",
  "Clutch time! \u{26A1}",
  "Don't ghost us! \u{1F47B}",
  "Last chance this week!",
  "You got this! \u{2728}",
] as const;

const MAX_CHARS = 280;

interface SendMessageProps {
  open: boolean;
  onClose: () => void;
  onSend: (message: string, recipientId?: string) => Promise<void>;
  members: MemberProgress[];
  currentUserId: string;
  podName: string;
  tier: ArenaTier;
}

export function SendMessage({
  open,
  onClose,
  onSend,
  members,
  currentUserId,
  podName,
  tier,
}: SendMessageProps) {
  const [message, setMessage] = useState("");
  const [targetId, setTargetId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tc = tierCfg(tier);

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  useEffect(() => {
    if (open) {
      setMessage("");
      setTargetId(undefined);
      setSending(false);
      setSent(false);
      // Focus textarea after animation
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSend(message.trim(), targetId);
      setSent(true);
      setTimeout(() => onClose(), 1400);
    } catch {
      setSending(false);
    }
  }

  function selectQuickLine(line: string) {
    setMessage(line);
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.80)",
              backdropFilter: "blur(6px)",
              zIndex: 9998,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={Y2K.spring}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: "rgba(6,8,18,0.98)",
              borderTop: `2px solid ${Y2K.cyan}`,
              borderRadius: "16px 16px 0 0",
              padding: "12px 16px 32px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center" style={{ marginBottom: "8px" }}>
              <div
                style={{
                  width: "36px",
                  height: "3px",
                  borderRadius: "1.5px",
                  background: "rgba(255,255,255,0.15)",
                }}
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
              <div>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: Y2K.cyan,
                    display: "block",
                  }}
                >
                  SEND MESSAGE
                </span>
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
                  {podName}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: Y2K.rFull,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${Y2K.border1}`,
                  color: Y2K.text2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {sent ? (
              /* Success state */
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center"
                style={{ padding: "32px 0" }}
              >
                <Sparkles size={28} style={{ color: Y2K.cyan, marginBottom: "8px" }} />
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "14px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: Y2K.cyan,
                  }}
                >
                  MESSAGE SENT
                </span>
              </motion.div>
            ) : (
              <>
                {/* Quick lines */}
                <div style={{ marginBottom: "12px" }}>
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "8px",
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: Y2K.text3,
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    QUICK MESSAGES
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_LINES.map((line) => (
                      <button
                        key={line}
                        onClick={() => selectQuickLine(line)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: Y2K.rFull,
                          background:
                            message === line ? Y2K.cyanBg : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            message === line ? Y2K.cyanBorder : Y2K.border1
                          }`,
                          color: message === line ? Y2K.cyan : Y2K.text2,
                          fontFamily: Y2K.fontDisplay,
                          fontSize: "8px",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target player */}
                {otherMembers.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <span
                      style={{
                        fontFamily: Y2K.fontDisplay,
                        fontSize: "8px",
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: Y2K.text3,
                        display: "block",
                        marginBottom: "6px",
                      }}
                    >
                      SEND TO
                    </span>
                    <div className="flex gap-1 overflow-x-auto">
                      {/* Broadcast option */}
                      <button
                        onClick={() => setTargetId(undefined)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: Y2K.rFull,
                          background:
                            targetId === undefined
                              ? Y2K.cyanBg
                              : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            targetId === undefined ? Y2K.cyanBorder : Y2K.border1
                          }`,
                          color: targetId === undefined ? Y2K.cyan : Y2K.text2,
                          fontFamily: Y2K.fontDisplay,
                          fontSize: "8px",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        ALL
                      </button>
                      {otherMembers.map((m) => {
                        const mStatus = getPlayerStatus(m);
                        const msc = statusCfg(mStatus);
                        const selected = targetId === m.user_id;
                        return (
                          <button
                            key={m.user_id}
                            onClick={() => setTargetId(m.user_id)}
                            className="flex items-center gap-1"
                            style={{
                              padding: "4px 8px",
                              borderRadius: Y2K.rFull,
                              background: selected ? `${msc.fg}15` : "rgba(255,255,255,0.04)",
                              border: `1px solid ${selected ? `${msc.fg}40` : Y2K.border1}`,
                              color: selected ? msc.fg : Y2K.text2,
                              fontFamily: Y2K.fontDisplay,
                              fontSize: "8px",
                              fontWeight: 900,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(m.display_name || m.username)}
                            <span
                              style={{
                                width: "4px",
                                height: "4px",
                                borderRadius: "50%",
                                background: msc.fg,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom message */}
                <div style={{ marginBottom: "12px" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: "4px" }}>
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
                      CUSTOM MESSAGE
                    </span>
                    <span
                      style={{
                        fontFamily: Y2K.fontSans,
                        fontSize: "9px",
                        color: message.length > MAX_CHARS ? Y2K.status.critical.fg : Y2K.text3,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {message.length}/{MAX_CHARS}
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                    rows={3}
                    placeholder="Type your message..."
                    style={{
                      width: "100%",
                      resize: "none",
                      padding: "8px",
                      borderRadius: Y2K.r12,
                      background: Y2K.bg3,
                      border: `1px solid ${Y2K.border2}`,
                      color: Y2K.text1,
                      fontFamily: Y2K.fontSans,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: Y2K.rFull,
                    background: message.trim()
                      ? `linear-gradient(135deg, ${Y2K.cyan}, ${Y2K.cyanDim})`
                      : "rgba(255,255,255,0.06)",
                    border: message.trim()
                      ? `1px solid ${Y2K.cyan}`
                      : `1px solid ${Y2K.border1}`,
                    color: message.trim() ? Y2K.bg0 : Y2K.text3,
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: message.trim() ? "pointer" : "not-allowed",
                    opacity: sending ? 0.5 : 1,
                    boxShadow: message.trim() ? Y2K.cyanGlow : undefined,
                  }}
                >
                  {sending ? "SENDING..." : "Send"}
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** @deprecated Use SendMessage instead */
export const SendComms = SendMessage;
