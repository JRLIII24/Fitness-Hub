# Fit-Hub — 01_AI_COACH Component Source

---
## src/components/coach/coach-chat-sheet.tsx
```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUp, Mic, Plus, Dumbbell, ArrowRightLeft, Volume2, VolumeX } from "lucide-react";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { speakAsJarvis, stopSpeaking } from "@/lib/voice/text-to-speech";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import { CoachFeedItem } from "./coach-feed-item";
import { isMutationAction } from "@/lib/coach/types";
import { executeCoachAction } from "@/lib/coach/action-executor";
import type {
  CoachMessage,
  CoachContext,
  CoachRequest,
  CoachResponse,
  CoachAction,
} from "@/lib/coach/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

let msgIdCounter = 0;
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

type HudState = "idle" | "listening" | "thinking" | "executing";

// ── Quick action presets ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Add exercise", icon: Plus, prompt: "Add " },
  { label: "Log a set", icon: Dumbbell, prompt: "I just did " },
  { label: "Swap movement", icon: ArrowRightLeft, prompt: "Swap " },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface CoachChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  context: CoachContext;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CoachChatSheet({
  isOpen,
  onClose,
  initialMessage,
  context,
}: CoachChatSheetProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hudState, setHudState] = useState<HudState>("idle");
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("coach-voice-enabled") !== "false";
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialMessageSentRef = useRef(false);

  const { isListening, transcript, startListening, stopListening } =
    useVoiceCommands();

  const router = useRouter();
  const workoutStore = useWorkoutStore();
  const timerStore = useTimerStore();

  // ── Voice toggle ──────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("coach-voice-enabled", String(next));
      if (!next) stopSpeaking();
      return next;
    });
  }, []);

  // Stop speech when sheet closes
  useEffect(() => {
    if (!isOpen) stopSpeaking();
  }, [isOpen]);

  // ── Sync HUD state ────────────────────────────────────────────────────

  useEffect(() => {
    if (isListening) setHudState("listening");
    else if (isSending) setHudState("thinking");
    else setHudState("idle");
  }, [isListening, isSending]);

  // ── Send initial message on open ──────────────────────────────────────

  useEffect(() => {
    if (isOpen && initialMessage && !initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      sendMessage(initialMessage);
    }
    if (!isOpen) {
      initialMessageSentRef.current = false;
    }
  }, [isOpen, initialMessage]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Focus input on open ───────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  // ── Voice transcript handling ─────────────────────────────────────────

  useEffect(() => {
    if (transcript) setInputValue(transcript);
  }, [transcript]);

  useEffect(() => {
    if (!isListening && transcript && transcript === inputValue) {
      sendMessage(transcript);
      setInputValue("");
    }
  }, [isListening]);

  // ── Send message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;

      const userMsg: CoachMessage = {
        id: nextMsgId(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      setHudState("thinking");

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const request: CoachRequest = {
          message: text.trim(),
          conversation_history: conversationHistory,
          context,
        };

        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!res.ok) throw new Error("Coach API error");

        const response: CoachResponse = await res.json();
        const action = (response.action ?? "none") as CoachAction;

        // Execute mutation actions
        let actionResult: { success: boolean; message: string } | undefined;
        if (isMutationAction(action)) {
          setHudState("executing");
          actionResult = await executeCoachAction(action, response.data ?? null, {
            workout: workoutStore,
            timer: timerStore,
            router,
          });
        }

        const assistantMsg: CoachMessage = {
          id: nextMsgId(),
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
          action,
          data: response.data ?? undefined,
          actionResult,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (voiceEnabled) {
          speakAsJarvis(response.reply);
        }
      } catch {
        const errorMsg: CoachMessage = {
          id: nextMsgId(),
          role: "assistant",
          content: "Connection lost. Try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
        setHudState("idle");
      }
    },
    [messages, context, isSending, workoutStore, timerStore, router, voiceEnabled]
  );

  // ── Submit handler ────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;
      sendMessage(inputValue);
      setInputValue("");
    },
    [inputValue, sendMessage]
  );

  // ── Quick action handler ──────────────────────────────────────────────

  const handleQuickAction = useCallback((prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // ── Portal ────────────────────────────────────────────────────────────

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <HudShell
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          isSending={isSending}
          isListening={isListening}
          hudState={hudState}
          voiceEnabled={voiceEnabled}
          onSubmit={handleSubmit}
          onClose={onClose}
          onMicTap={() => (isListening ? stopListening() : startListening())}
          onToggleVoice={toggleVoice}
          onQuickAction={handleQuickAction}
          scrollRef={scrollRef}
          inputRef={inputRef}
        />
      )}
    </AnimatePresence>,
    portalTarget
  );
}

// ── HUD Shell ────────────────────────────────────────────────────────────────

function HudShell({
  messages,
  inputValue,
  setInputValue,
  isSending,
  isListening,
  hudState,
  voiceEnabled,
  onSubmit,
  onClose,
  onMicTap,
  onToggleVoice,
  onQuickAction,
  scrollRef,
  inputRef,
}: {
  messages: CoachMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  isSending: boolean;
  isListening: boolean;
  hudState: HudState;
  voiceEnabled: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onMicTap: () => void;
  onToggleVoice: () => void;
  onQuickAction: (prompt: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const hudClass =
    hudState === "thinking"
      ? "hud-sheet-thinking"
      : hudState === "listening"
        ? "hud-sheet-listening"
        : "hud-sheet-idle";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* HUD Sheet */}
      <motion.div
        initial={{ y: "100%", opacity: 0.8 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.5 }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className={`fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-0.5rem))] min-h-[50dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/30 bg-black/70 backdrop-blur-xl ${hudClass}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-0">
          <div className="h-[3px] w-8 rounded-full bg-white/15" />
        </div>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2">
          <div className="flex items-center gap-3">
            {/* Glow orb */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: hudState === "idle"
                    ? "radial-gradient(circle, oklch(0.7 0.12 220 / 0.2) 0%, transparent 70%)"
                    : hudState === "thinking"
                      ? "radial-gradient(circle, oklch(0.7 0.18 220 / 0.5) 0%, transparent 70%)"
                      : hudState === "listening"
                        ? "radial-gradient(circle, oklch(0.7 0.15 220 / 0.4) 0%, transparent 70%)"
                        : "radial-gradient(circle, oklch(0.72 0.18 145 / 0.4) 0%, transparent 70%)",
                  animation: hudState !== "idle" ? "hud-orb 1.5s ease-in-out infinite" : undefined,
                }}
              />
              <div
                className="relative h-2.5 w-2.5 rounded-full"
                style={{
                  background: hudState === "idle"
                    ? "oklch(0.5 0.05 220)"
                    : hudState === "thinking"
                      ? "oklch(0.7 0.18 220)"
                      : hudState === "listening"
                        ? "oklch(0.7 0.15 220)"
                        : "oklch(0.72 0.18 145)",
                  boxShadow: hudState !== "idle"
                    ? `0 0 8px oklch(0.7 0.15 220 / 0.5)`
                    : undefined,
                }}
              />
            </div>
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
                COACH
              </h2>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/30">
                {hudState === "thinking"
                  ? "PROCESSING"
                  : hudState === "listening"
                    ? "LISTENING"
                    : hudState === "executing"
                      ? "EXECUTING"
                      : "READY"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Jarvis voice toggle */}
            <button
              onClick={onToggleVoice}
              title={voiceEnabled ? "Mute JARVIS" : "Enable JARVIS voice"}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                voiceEnabled
                  ? "border-primary/30 bg-primary/10 text-primary/70 hover:text-primary"
                  : "border-white/10 bg-white/5 text-white/30 hover:text-white/60"
              }`}
            >
              {voiceEnabled
                ? <Volume2 className="h-3.5 w-3.5" />
                : <VolumeX className="h-3.5 w-3.5" />
              }
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Divider with glow */}
        <div className="relative h-px mx-5">
          <div className="absolute inset-0 bg-white/[0.06]" />
          {hudState !== "idle" && (
            <div
              className="absolute inset-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, oklch(0.7 0.15 220 / 0.3), transparent)",
              }}
            />
          )}
        </div>

        {/* ── Command Feed ─────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <EmptyState hudState={hudState} onQuickAction={onQuickAction} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, i) => (
                <CoachFeedItem
                  key={msg.id}
                  message={msg}
                  isLatest={i === messages.length - 1}
                  index={i}
                  totalCount={messages.length}
                />
              ))}

              {/* Scan-line thinking indicator */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative h-6 overflow-hidden rounded"
                >
                  <div
                    className="absolute inset-0 h-full w-1/4"
                    style={{
                      background: "linear-gradient(90deg, transparent, oklch(0.7 0.15 220 / 0.15), transparent)",
                      animation: "hud-scan 1s linear infinite",
                    }}
                  />
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ── Command Input ────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.06] px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-3">
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            {/* Command prompt input */}
            <div className="relative flex-1 flex items-center">
              <span className="absolute left-3 text-[13px] font-mono text-primary/50 pointer-events-none select-none">
                &gt;
              </span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="command..."
                className="min-h-[42px] w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-7 pr-3 text-[12px] font-mono text-foreground placeholder:text-white/20 focus:border-primary/30 focus:outline-none focus:shadow-[0_0_12px_oklch(0.7_0.15_220/0.15)] transition-shadow"
                disabled={isSending}
              />
            </div>

            {/* Mic button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onMicTap}
              className={`relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition-all ${
                isListening
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/60"
              }`}
            >
              {isListening && (
                <span
                  className="absolute inset-0 rounded-lg border border-primary/30"
                  style={{ animation: "hud-glow-pulse 1.5s ease-in-out infinite" }}
                />
              )}
              <Mic className="h-4 w-4" />
            </motion.button>

            {/* Send button */}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              disabled={!inputValue.trim() || isSending}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/20 disabled:opacity-20 disabled:border-white/[0.06] disabled:text-white/20 hover:bg-primary/30 transition-all"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </form>
        </div>
      </motion.div>
    </>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  hudState,
  onQuickAction,
}: {
  hudState: HudState;
  onQuickAction: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {/* Large glow orb */}
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.7 0.15 220 / 0.15) 0%, transparent 60%)",
            animation: "hud-orb 3s ease-in-out infinite",
          }}
        />
        <div
          className="relative h-4 w-4 rounded-full"
          style={{
            background: "oklch(0.6 0.1 220)",
            boxShadow: "0 0 16px oklch(0.7 0.15 220 / 0.3), 0 0 40px oklch(0.7 0.15 220 / 0.1)",
          }}
        />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-1">
        {hudState === "idle" ? "READY" : "INITIALIZING"}
      </p>
      <p className="max-w-[200px] text-[11px] text-white/20 mb-6">
        Add exercises, log sets, swap movements, and control your workout.
      </p>

      {/* Quick action chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_ACTIONS.map((qa) => (
          <motion.button
            key={qa.label}
            whileTap={{ scale: 0.97 }}
            onClick={() => onQuickAction(qa.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-white/40 transition-colors hover:border-primary/20 hover:text-white/60"
          >
            <qa.icon className="size-3" />
            {qa.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

---
## src/components/coach/coach-fab-wrapper.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { AI_COACH_ENABLED } from "@/lib/features";
import { useWorkoutStore } from "@/stores/workout-store";
import { CoachFab } from "./coach-fab";
import type { CoachContext } from "@/lib/coach/types";

type MacroSummary = CoachContext["daily_macros"];

/**
 * Thin client wrapper so the server-rendered app layout can mount CoachFab
 * without needing to pass runtime context from the server.
 *
 * Builds a rich CoachContext from:
 *  - useWorkoutStore (active workout detail)
 *  - GET /api/nutrition/today (today's macro consumption vs targets)
 */
export function CoachFabWrapper() {
  // All hooks must be called unconditionally — Rules of Hooks
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const [dailyMacros, setDailyMacros] = useState<MacroSummary>(null);

  // Fetch today's macro summary once on mount — only when feature is enabled
  useEffect(() => {
    if (!AI_COACH_ENABLED) return;
    fetch("/api/nutrition/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // Only set if we have at least one target configured
        if (data.target_calories != null) {
          setDailyMacros(data as MacroSummary);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!AI_COACH_ENABLED) return null;

  const context: CoachContext = {
    active_workout: activeWorkout
      ? {
          name: activeWorkout.name,
          exercises: activeWorkout.exercises.map((we) => ({
            name: we.exercise.name,
            muscle_group: we.exercise.muscle_group,
            sets_completed: we.sets.filter((s) => s.completed).length,
            sets_total: we.sets.length,
            sets: we.sets.map((s) => ({
              set_number: s.set_number,
              weight_kg: s.weight_kg,
              reps: s.reps,
              set_type: s.set_type,
              completed: s.completed,
              rpe: s.rpe,
              rir: s.rir,
            })),
          })),
          duration_minutes: Math.round(
            (Date.now() - new Date(activeWorkout.started_at).getTime()) / 60000,
          ),
        }
      : null,
    readiness_score: null,
    readiness_level: null,
    recent_sessions_7d: 0,
    current_streak: 0,
    fitness_goal: null,
    experience_level: null,
    daily_macros: dailyMacros,
    recent_prs: null,
  };

  return <CoachFab context={context} />;
}
```

---
## src/components/coach/coach-fab.tsx
```tsx
"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { AI_COACH_ENABLED } from "@/lib/features";
import { CoachChatSheet } from "./coach-chat-sheet";
import type { CoachContext } from "@/lib/coach/types";

interface CoachFabProps {
  /** Pre-built coach context — caller constructs from stores/props. */
  context: CoachContext;
  /** Shift up when the voice command bar is visible. */
  hasVoiceBar?: boolean;
}

export function CoachFab({ context, hasVoiceBar = false }: CoachFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();

  const handleOpen = useCallback((message?: string) => {
    if (message) setInitialMessage(message);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setInitialMessage(undefined);
  }, []);

  if (!AI_COACH_ENABLED) return null;

  return (
    <>
      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => handleOpen()}
        className="fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        style={{
          right: 16,
          bottom: hasVoiceBar ? 160 : 96,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <MessageCircle className="h-5 w-5" />
      </motion.button>

      {/* Chat sheet */}
      <CoachChatSheet
        isOpen={isOpen}
        onClose={handleClose}
        initialMessage={initialMessage}
        context={context}
      />
    </>
  );
}
```

---
## src/components/coach/coach-feed-item.tsx
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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
import type { CoachMessage, AutoregulationPrescription } from "@/lib/coach/types";
import { isMutationAction } from "@/lib/coach/types";
import { PrescriptionCard } from "./prescription-card";
import { ExerciseHistoryCard } from "./exercise-history-card";

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
}

export function CoachFeedItem({ message, isLatest, index, totalCount }: CoachFeedItemProps) {
  const isUser = message.role === "user";
  const hasMutation = message.action ? isMutationAction(message.action) : false;
  const { displayed, done } = useTypewriter(
    message.content,
    !isUser && isLatest,
  );

  // Fade older messages
  const fadeSteps = totalCount - 1 - index; // 0 = latest, 1 = second latest, etc.
  const opacity = fadeSteps === 0 ? 1 : fadeSteps === 1 ? 0.8 : fadeSteps === 2 ? 0.6 : 0.5;

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // ── User command line ───────────────────────────────────────────────────
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity }}
        transition={{ duration: 0.15 }}
        className="flex items-baseline justify-between gap-4"
      >
        <p className="text-[12px] text-muted-foreground/80 font-mono">
          <span className="text-primary/60 mr-1">&gt;</span>
          {message.content}
        </p>
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/40">
          {time}
        </span>
      </motion.div>
    );
  }

  // ── AI response card ────────────────────────────────────────────────────
  const borderColor = hasMutation
    ? message.actionResult?.success
      ? "border-l-emerald-400/60"
      : message.actionResult
        ? "border-l-red-400/60"
        : "border-l-amber-400/40"
    : "border-l-transparent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity }}
      transition={{ duration: 0.25 }}
      style={isLatest && !done ? { animation: "hud-execute-flash 0.4s ease-out" } : undefined}
      className={`relative rounded-lg border border-border/40 bg-card/30 pl-3 pr-3 py-2.5 border-l-[3px] ${borderColor}`}
    >
      {/* Scan-line overlay on latest while typing */}
      {isLatest && !done && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <div
            className="absolute inset-0 h-full w-1/3"
            style={{
              background: "linear-gradient(90deg, transparent, oklch(0.7 0.15 220 / 0.06), transparent)",
              animation: "hud-scan 1.2s linear infinite",
            }}
          />
        </div>
      )}

      {/* Execution badge */}
      {hasMutation && message.actionResult && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
              message.actionResult.success
                ? "bg-emerald-400/15 text-emerald-400"
                : "bg-red-400/15 text-red-400"
            }`}
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
            <span className="text-[10px] font-semibold text-muted-foreground">
              {message.actionResult.message}
            </span>
          )}
        </div>
      )}

      {/* Response text */}
      <p className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {displayed}
        {!done && (
          <span className="inline-block w-[5px] h-[13px] bg-primary/60 ml-0.5 animate-pulse" />
        )}
      </p>

      {/* Inline action data */}
      {hasMutation && message.action && done && (
        <ActionDataGrid action={message.action} data={message.data} />
      )}

      {/* Display action cards */}
      {message.action === "show_prescription" && !!message.data?.prescription && done && (
        <div className="mt-2.5">
          <PrescriptionCard
            prescription={message.data.prescription as AutoregulationPrescription}
          />
        </div>
      )}

      {message.action === "show_exercise_history" && !!message.data?.exercise_history && done && (
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

      {/* Timestamp */}
      <p className="mt-1.5 text-[9px] tabular-nums text-muted-foreground/40">{time}</p>
    </motion.div>
  );
}
```

---
## src/components/coach/exercise-history-card.tsx
```tsx
"use client";

import { Dumbbell } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";

interface ExerciseHistoryData {
  exercise_name: string;
  sessions: Array<{
    date: string;
    sets: Array<{
      weight_kg: number;
      reps: number;
      rpe?: number;
    }>;
  }>;
}

interface ExerciseHistoryCardProps {
  data: ExerciseHistoryData;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function summarizeSets(
  sets: ExerciseHistoryData["sessions"][0]["sets"],
  isImperial: boolean
): string {
  return sets
    .map((s) => {
      const w = weightToDisplay(s.weight_kg, isImperial, 0);
      const unit = isImperial ? "lb" : "kg";
      const rpeStr = s.rpe ? ` @${s.rpe}` : "";
      return `${w}${unit} x ${s.reps}${rpeStr}`;
    })
    .join(", ");
}

export function ExerciseHistoryCard({ data }: ExerciseHistoryCardProps) {
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Dumbbell className="h-3.5 w-3.5 text-primary" />
        <h4 className="text-[12px] font-bold text-foreground">
          {data.exercise_name}
        </h4>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
          Last {data.sessions.length} sessions
        </span>
      </div>

      {/* Compact table */}
      <div className="flex flex-col gap-1">
        {/* Header row */}
        <div className="grid grid-cols-[60px_1fr] gap-2 px-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Date
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Sets
          </span>
        </div>

        {data.sessions.map((session, i) => (
          <div
            key={session.date}
            className={`grid grid-cols-[60px_1fr] gap-2 rounded-lg px-1 py-1 ${
              i % 2 === 0 ? "bg-card/30" : ""
            }`}
          >
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {formatDate(session.date)}
            </span>
            <span className="text-[11px] text-foreground truncate">
              {summarizeSets(session.sets, isImperial)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---
## src/components/coach/prescription-card.tsx
```tsx
"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";
import type { AutoregulationPrescription } from "@/lib/coach/types";

interface PrescriptionCardProps {
  prescription: AutoregulationPrescription;
}

const FACTOR_CONFIG = {
  push: {
    label: "Push",
    color: "hsl(142, 71%, 45%)",
    bgAlpha: "rgba(34, 197, 94, 0.12)",
    borderAlpha: "rgba(34, 197, 94, 0.25)",
    Icon: TrendingUp,
  },
  maintain: {
    label: "Maintain",
    color: "hsl(38, 92%, 50%)",
    bgAlpha: "rgba(245, 158, 11, 0.12)",
    borderAlpha: "rgba(245, 158, 11, 0.25)",
    Icon: Minus,
  },
  deload: {
    label: "Deload",
    color: "hsl(0, 84%, 60%)",
    bgAlpha: "rgba(239, 68, 68, 0.12)",
    borderAlpha: "rgba(239, 68, 68, 0.25)",
    Icon: TrendingDown,
  },
} as const;

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const factor = FACTOR_CONFIG[prescription.readiness_factor];
  const FactorIcon = factor.Icon;

  const displayWeight = weightToDisplay(
    prescription.target_weight_kg,
    isImperial,
    1
  );
  const unitLabel = isImperial ? "lbs" : "kg";

  const overloadSign = prescription.progressive_overload_pct >= 0 ? "+" : "";
  const overloadText = `${overloadSign}${prescription.progressive_overload_pct.toFixed(1)}%`;

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
      {/* Header: exercise name + readiness badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-bold text-foreground leading-tight">
          {prescription.exercise_name}
        </h4>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: factor.bgAlpha,
            color: factor.color,
            border: `1px solid ${factor.borderAlpha}`,
          }}
        >
          <FactorIcon className="h-3 w-3" />
          {factor.label}
        </span>
      </div>

      {/* Target row */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Weight
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {displayWeight}
            <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
              {unitLabel}
            </span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Reps
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {prescription.target_reps}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sets
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {prescription.target_sets}
          </p>
        </div>
      </div>

      {/* Progressive overload */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Overload
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ background: factor.bgAlpha, color: factor.color }}
        >
          {overloadText}
        </span>
      </div>

      {/* Rationale */}
      {prescription.rationale && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {prescription.rationale}
        </p>
      )}
    </div>
  );
}
```

---
## src/components/coach/voice-command-bar.tsx
```tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Check, X } from "lucide-react";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { VOICE_LOGGING_ENABLED } from "@/lib/features";
import { weightToDisplay } from "@/lib/units";
import type { VoiceIntent } from "@/lib/coach/types";

// ── Timer regex (avoid API call for simple commands) ─────────────────────────

const TIMER_REGEX =
  /(?:(?:start|set|begin)\s+(?:a\s+)?(?:timer|rest)\s*(?:for\s+)?)?(\d+)\s*(?:second|sec|s)\s*(?:timer|rest)?/i;
const TIMER_MINUTE_REGEX =
  /(?:(?:start|set|begin)\s+(?:a\s+)?(?:timer|rest)\s*(?:for\s+)?)?(\d+(?:\.\d+)?)\s*(?:minute|min|m)\s*(?:timer|rest)?/i;

function tryLocalTimerParse(transcript: string): number | null {
  const secMatch = transcript.match(TIMER_REGEX);
  if (secMatch) return parseInt(secMatch[1], 10);

  const minMatch = transcript.match(TIMER_MINUTE_REGEX);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);

  return null;
}

// ── Toast state ──────────────────────────────────────────────────────────────

type BarState = "idle" | "listening" | "processing" | "result";

interface ToastInfo {
  message: string;
  variant: "success" | "error";
}

interface VoiceCommandBarProps {
  onOpenCoach?: (initialMessage: string) => void;
}

export function VoiceCommandBar({ onOpenCoach }: VoiceCommandBarProps) {
  const [barState, setBarState] = useState<BarState>("idle");
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isListening, transcript, startListening, stopListening, error } =
    useVoiceCommands();

  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const startTimer = useTimerStore((s) => s.startTimer);
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  // Sync bar state with hook
  useEffect(() => {
    if (isListening) {
      setBarState("listening");
    }
  }, [isListening]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showToast(error, "error");
      setBarState("idle");
    }
  }, [error]);

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ message, variant });
    setBarState("result");

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      setBarState("idle");
    }, 2500);
  }, []);

  // ── Process transcript when listening stops ──────────────────────────────

  const lastProcessedRef = useRef("");

  useEffect(() => {
    if (isListening || !transcript || transcript === lastProcessedRef.current) return;
    lastProcessedRef.current = transcript;
    processTranscript(transcript);
  }, [isListening, transcript]);

  const processTranscript = useCallback(
    async (text: string) => {
      // 1. Try local timer parse first
      const timerSeconds = tryLocalTimerParse(text);
      if (timerSeconds && timerSeconds > 0 && timerSeconds <= 600) {
        startTimer("voice", "Rest", timerSeconds);
        showToast(`Timer: ${timerSeconds}s`, "success");
        return;
      }

      // 2. Call voice-intent API
      setBarState("processing");
      try {
        const res = await fetch("/api/ai/voice-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            has_active_workout: !!activeWorkout,
          }),
        });

        if (!res.ok) {
          showToast("Could not understand command", "error");
          return;
        }

        const intent: VoiceIntent = await res.json();
        routeIntent(intent, text);
      } catch {
        showToast("Failed to process voice command", "error");
      }
    },
    [activeWorkout, startTimer, showToast]
  );

  const routeIntent = useCallback(
    (intent: VoiceIntent, originalText: string) => {
      switch (intent.type) {
        case "log_set": {
          if (!activeWorkout || !intent.parsed_data?.sets?.length) {
            showToast("No active workout to log to", "error");
            return;
          }
          const setData = intent.parsed_data.sets[0];
          const exerciseIdx = 0; // Log to first exercise by default
          const exercise = activeWorkout.exercises[exerciseIdx];
          if (!exercise) {
            showToast("No exercise found", "error");
            return;
          }

          // Add a new set and update it
          const setIdx = exercise.sets.length;
          addSet(exerciseIdx);
          if (setData.weight !== null || setData.reps !== null) {
            const weightKg =
              setData.weight !== null
                ? setData.unit === "lbs"
                  ? setData.weight / 2.20462
                  : setData.weight
                : null;
            updateSet(exerciseIdx, setIdx, {
              weight_kg: weightKg,
              reps: setData.reps,
              rpe: setData.rpe,
              rir: setData.rir,
            });
            completeSet(exerciseIdx, setIdx);
          }

          const displayWeight =
            setData.weight !== null
              ? `${isImperial && setData.unit !== "lbs" ? weightToDisplay(setData.weight, true, 0) : setData.weight}${isImperial ? "lb" : "kg"}`
              : "";
          const displayReps = setData.reps !== null ? ` x ${setData.reps}` : "";
          showToast(`Logged: ${displayWeight}${displayReps}`, "success");
          break;
        }

        case "start_timer": {
          const seconds = intent.parsed_data?.timer_seconds ?? 90;
          startTimer("voice", "Rest", seconds);
          showToast(`Timer: ${seconds}s`, "success");
          break;
        }

        case "swap_exercise": {
          const name = intent.parsed_data?.exercise_name ?? "exercise";
          onOpenCoach?.(`Swap ${name} for a similar exercise`);
          setBarState("idle");
          break;
        }

        case "ask_coach": {
          const query = intent.parsed_data?.coach_query ?? originalText;
          onOpenCoach?.(query);
          setBarState("idle");
          break;
        }

        default:
          showToast("Didn't catch that — try again", "error");
      }
    },
    [activeWorkout, addSet, updateSet, completeSet, startTimer, isImperial, showToast, onOpenCoach]
  );

  // ── Tap handler ──────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    if (barState === "listening") {
      stopListening();
    } else if (barState === "idle" || barState === "result") {
      lastProcessedRef.current = "";
      startListening();
    }
  }, [barState, startListening, stopListening]);

  if (!VOICE_LOGGING_ENABLED) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <AnimatePresence mode="wait">
        {/* Toast */}
        {barState === "result" && toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-max max-w-[240px]"
          >
            <div
              className={`rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-lg backdrop-blur-md ${
                toast.variant === "success"
                  ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-300"
                  : "border-rose-500/30 bg-rose-950/80 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.variant === "success" ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0" />
                )}
                {toast.message}
              </div>
            </div>
          </motion.div>
        )}

        {/* Transcript preview */}
        {barState === "listening" && transcript && (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-16 right-0 w-max max-w-[240px]"
          >
            <div className="rounded-xl border border-border/50 bg-card/90 px-3 py-2 text-[12px] font-medium text-foreground shadow-lg backdrop-blur-md">
              {transcript}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleTap}
        disabled={barState === "processing"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors"
        style={{
          background:
            barState === "listening"
              ? "hsl(var(--primary))"
              : barState === "processing"
                ? "hsl(var(--muted))"
                : "hsl(var(--card))",
          border: "1px solid hsl(var(--border) / 0.6)",
        }}
      >
        {/* Pulsing ring when listening */}
        {barState === "listening" && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        {barState === "processing" ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        ) : barState === "listening" ? (
          <MicOff className="h-5 w-5 text-primary-foreground" />
        ) : (
          <Mic className="h-5 w-5 text-foreground" />
        )}
      </motion.button>
    </div>
  );
}
```

