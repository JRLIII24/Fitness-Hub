"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { T } from "@/lib/coach-tokens";
import { AlertTriangle, Check, X, ArrowRightLeft, Minus, Pencil } from "lucide-react";
import type { PendingAction } from "@/lib/coach/types";

function ActionIcon({ action }: { action: string }) {
  const cls = "size-4";
  switch (action) {
    case "swap_exercise":
      return <ArrowRightLeft className={cls} />;
    case "remove_exercise":
      return <Minus className={cls} />;
    case "update_set":
      return <Pencil className={cls} />;
    default:
      return <AlertTriangle className={cls} />;
  }
}

interface ActionConfirmationCardProps {
  pending: PendingAction;
  onAccept: () => void;
  onDismiss: () => void;
  isExecuting?: boolean;
}

export function ActionConfirmationCard({
  pending,
  onAccept,
  onDismiss,
  isExecuting,
}: ActionConfirmationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        marginTop: 8,
        background: `linear-gradient(135deg, ${T.amber}08, ${T.amber}04)`,
        border: `1px solid ${T.amber}30`,
        borderRadius: T.r12,
        padding: "10px 12px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${T.amber}15`,
            border: `1px solid ${T.amber}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.amber,
            flexShrink: 0,
          }}
        >
          <ActionIcon action={pending.action} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.amber,
              margin: 0,
            }}
          >
            Confirm Action
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text1,
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pending.description}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDismiss}
          disabled={isExecuting}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 36,
            borderRadius: T.r8,
            border: `1px solid ${T.border2}`,
            background: T.glassElevated,
            fontSize: 11,
            fontWeight: 700,
            color: T.text2,
            cursor: isExecuting ? "default" : "pointer",
            opacity: isExecuting ? 0.4 : 1,
            transition: "all 0.15s",
          }}
        >
          <X size={13} />
          Dismiss
        </button>
        <button
          onClick={onAccept}
          disabled={isExecuting}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 36,
            borderRadius: T.r8,
            border: `1px solid ${T.volt}30`,
            background: `${T.volt}18`,
            fontSize: 11,
            fontWeight: 700,
            color: T.volt,
            cursor: isExecuting ? "default" : "pointer",
            opacity: isExecuting ? 0.6 : 1,
            transition: "all 0.15s",
          }}
        >
          {isExecuting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              style={{ width: 13, height: 13, border: `2px solid ${T.volt}`, borderTopColor: "transparent", borderRadius: "50%" }}
            />
          ) : (
            <Check size={13} />
          )}
          {isExecuting ? "Executing..." : "Accept"}
        </button>
      </div>
    </motion.div>
  );
}
