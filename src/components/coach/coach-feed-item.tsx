"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { T } from "@/lib/coach-tokens";
import {
  Check,
  X,
  ArrowRightLeft,
  Plus,
  Minus,
  Timer,
  Dumbbell,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { CoachMessage, AutoregulationPrescription, PendingAction } from "@/lib/coach/types";
import { isMutationAction } from "@/lib/coach/types";
import { PrescriptionCard } from "./prescription-card";
import { ExerciseHistoryCard } from "./exercise-history-card";
import { MealSuggestionCard } from "./meal-suggestion-card";
import { MacroBreakdownCard } from "./macro-breakdown-card";
import { ActionConfirmationCard } from "./action-confirmation-card";
import { WorkoutOptionsCard } from "./workout-options-card";
import type { PresentWorkoutOptionsActionData } from "@/lib/coach/types";

// ── Typewriter hook ─────────────────────────────────────────────────────────

function useTypewriter(text: string, enabled: boolean, speed = 16) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, enabled, speed]);

  return { displayed, done };
}

// ── Action icon ─────────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
  const cls = "size-3";
  switch (action) {
    case "add_exercise":
    case "create_and_add_exercise":
      return <Plus className={cls} />;
    case "swap_exercise":
      return <ArrowRightLeft className={cls} />;
    case "add_sets":
    case "update_set":
      return <Dumbbell className={cls} />;
    case "remove_exercise":
      return <Minus className={cls} />;
    case "start_timer":
      return <Timer className={cls} />;
    default:
      return <Zap className={cls} />;
  }
}

// ── Inline data grid for mutation results ───────────────────────────────────

function ActionDataGrid({ action, data }: { action: string; data?: Record<string, unknown> }) {
  if (!data) return null;

  if (action === "add_exercise" || action === "create_and_add_exercise") {
    const sets = (data.sets as Array<{ weight_kg?: number; reps?: number }>) ?? [];
    if (sets.length === 0) return null;
    return (
      <div className="mt-2 flex gap-1.5 flex-wrap">
        {sets.map((s, i) => (
          <span
            key={i}
            className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400"
          >
            {s.weight_kg ?? "?"}kg x {s.reps ?? "?"}
          </span>
        ))}
      </div>
    );
  }

  if (action === "add_sets") {
    const sets = (data.sets as Array<{ weight_kg?: number; reps?: number; rpe?: number }>) ?? [];
    return (
      <div className="mt-2 flex gap-1.5 flex-wrap">
        {sets.map((s, i) => (
          <span
            key={i}
            className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400"
          >
            {s.weight_kg ?? "?"}kg x {s.reps ?? "?"}{s.rpe ? ` @${s.rpe}` : ""}
          </span>
        ))}
      </div>
    );
  }

  if (action === "swap_exercise") {
    const from = data.current_exercise_name as string;
    const to = data.new_exercise_name as string;
    if (!from || !to) return null;
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground line-through">{from}</span>
        <ChevronRight className="size-3 text-sky-400" />
        <span className="font-bold text-sky-400">{to}</span>
      </div>
    );
  }

  if (action === "start_timer") {
    const seconds = data.seconds as number;
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <Timer className="size-3 text-amber-400" />
        <span className="text-[12px] font-black tabular-nums text-amber-400">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return null;
}

// ── Main feed item ──────────────────────────────────────────────────────────

interface CoachFeedItemProps {
  message: CoachMessage;
  isLatest: boolean;
  index: number;
  totalCount: number;
  onConfirmAction?: (msgId: string, pending: PendingAction) => void;
  onDismissAction?: (msgId: string) => void;
  isConfirming?: boolean;
  onSelectOption?: (text: string) => void;
  onTypingDone?: (msgId: string) => void;
  skipTypewriter?: boolean;
}

export function CoachFeedItem({ message, isLatest, index, totalCount, onConfirmAction, onDismissAction, isConfirming, onSelectOption, onTypingDone, skipTypewriter }: CoachFeedItemProps) {
  const isUser = message.role === "user";
  const hasMutation = message.action ? isMutationAction(message.action) : false;
  // When streaming, text arrives progressively — skip typewriter and render directly.
  // Only use typewriter for non-streaming assistant messages (e.g. from history).
  // Skip typewriter entirely for messages that have already been displayed (e.g. after close/reopen).
  const isStreaming = message.isStreaming === true;
  const shouldTypewrite = !isUser && isLatest && !isStreaming && !skipTypewriter;
  const { displayed, done } = useTypewriter(
    message.content,
    shouldTypewrite,
  );
  // Notify parent when typewriter finishes so re-opens don't re-animate
  useEffect(() => {
    if (done && shouldTypewrite) {
      onTypingDone?.(message.id);
    }
  }, [done, shouldTypewrite, message.id, onTypingDone]);

  // For streaming messages, show content directly and treat as "not done" while streaming
  const shownText = isStreaming ? message.content : displayed;
  const isComplete = isStreaming ? !isStreaming : done;

  // Fade older messages
  const fadeSteps = totalCount - 1 - index; // 0 = latest, 1 = second latest, etc.
  const opacity = fadeSteps === 0 ? 1 : fadeSteps === 1 ? 0.8 : fadeSteps === 2 ? 0.6 : 0.5;

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // ── User message bubble ──────────────────────────────────────────────────
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity }}
        transition={{ duration: 0.15 }}
        className="flex justify-end"
      >
        <div
          style={{
            maxWidth: "80%",
            background: `${T.volt}10`,
            border: `1px solid ${T.volt}20`,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: `${T.r20} ${T.r12} ${T.r20} ${T.r20}`,
            padding: "8px 12px",
          }}
        >
          <p style={{ fontSize: 12, color: T.text1, fontFamily: "monospace", margin: 0 }}>
            {message.content}
          </p>
          <p
            style={{
              fontSize: 9,
              color: T.text2,
              opacity: 0.5,
              marginTop: 4,
              marginBottom: 0,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {time}
          </p>
        </div>
      </motion.div>
    );
  }

  // ── AI response card ────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity }}
      transition={{ duration: 0.25 }}
      style={{
        ...(isLatest && !isComplete ? { animation: "hud-execute-flash 0.4s ease-out" } : {}),
        background: `linear-gradient(135deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: `${T.r12} ${T.r20} ${T.r20} ${T.r20}`,
        borderLeft: `3px solid ${hasMutation && message.actionResult ? (message.actionResult.success ? `${T.success}99` : `${T.error}99`) : "transparent"}`,
        padding: "10px 12px",
        position: "relative",
      }}
    >
      {/* Scan-line overlay on latest while typing */}
      {isLatest && !isComplete && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <div
            className="absolute inset-0 h-full w-1/3"
            style={{
              background: `linear-gradient(90deg, transparent, ${T.volt}15, transparent)`,
              animation: "hud-scan 1.2s linear infinite",
            }}
          />
        </div>
      )}

      {/* Execution badge — glass styled */}
      {hasMutation && message.actionResult && (
        <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              borderRadius: T.r8,
              padding: "3px 8px",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: message.actionResult.success
                ? `linear-gradient(135deg, ${T.success}15, ${T.success}08)`
                : `linear-gradient(135deg, ${T.error}15, ${T.error}08)`,
              border: `1px solid ${message.actionResult.success ? `${T.success}30` : `${T.error}30`}`,
              color: message.actionResult.success ? T.success : T.error,
            }}
          >
            {message.actionResult.success ? (
              <>
                <ActionIcon action={message.action!} />
                EXECUTED
              </>
            ) : (
              <>
                <X className="size-3" />
                FAILED
              </>
            )}
          </span>
          {message.actionResult.message && (
            <span style={{ fontSize: 10, fontWeight: 600, color: T.text2 }}>
              {message.actionResult.message}
            </span>
          )}
        </div>
      )}

      {/* Response text */}
      <p className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {shownText}
        {!isComplete && (
          <span className="inline-block w-[5px] h-[13px] bg-primary/60 ml-0.5 animate-pulse" />
        )}
      </p>

      {/* Inline action data */}
      {hasMutation && message.action && isComplete && (
        <ActionDataGrid action={message.action} data={message.data} />
      )}

      {/* Display action cards */}
      {message.action === "show_prescription" && !!message.data?.prescription && isComplete && (
        <div className="mt-2.5">
          <PrescriptionCard
            prescription={message.data.prescription as AutoregulationPrescription}
          />
        </div>
      )}

      {message.action === "show_meal_suggestion" && isComplete && (
        <div className="mt-2.5">
          <MealSuggestionCard data={message.data} />
        </div>
      )}

      {message.action === "show_macro_breakdown" && isComplete && (
        <div className="mt-2.5">
          <MacroBreakdownCard data={message.data} />
        </div>
      )}

      {message.action === "show_exercise_history" && !!message.data?.exercise_history && isComplete && (
        <div className="mt-2.5">
          <ExerciseHistoryCard
            data={
              message.data.exercise_history as {
                exercise_name: string;
                sessions: Array<{
                  date: string;
                  sets: Array<{ weight_kg: number; reps: number; rpe?: number }>;
                }>;
              }
            }
          />
        </div>
      )}

      {message.action === "present_workout_options" && !!message.data?.options && isComplete && (
        <WorkoutOptionsCard
          data={message.data as unknown as PresentWorkoutOptionsActionData}
          onSelectOption={onSelectOption ?? (() => {})}
        />
      )}

      {/* Pending action confirmation */}
      {message.pendingAction && !message.dismissed && !message.actionResult && isComplete && (
        <ActionConfirmationCard
          pending={message.pendingAction}
          onAccept={() => onConfirmAction?.(message.id, message.pendingAction!)}
          onDismiss={() => onDismissAction?.(message.id)}
          isExecuting={isConfirming}
        />
      )}

      {/* Dismissed badge */}
      {message.dismissed && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.text2,
              opacity: 0.5,
            }}
          >
            Action dismissed
          </span>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-1.5 text-[9px] tabular-nums text-muted-foreground/40">{time}</p>
    </motion.div>
  );
}
