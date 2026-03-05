# Fit-Hub Component Source Export
> Generated 2026-03-05 — All UI components for Figma AI redesign


---
## FILE: src/components/coach/coach-chat-sheet.tsx
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
## FILE: src/components/coach/coach-fab-wrapper.tsx
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
## FILE: src/components/coach/coach-fab.tsx
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
## FILE: src/components/coach/coach-feed-item.tsx
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
## FILE: src/components/coach/exercise-history-card.tsx
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
## FILE: src/components/coach/prescription-card.tsx
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
## FILE: src/components/coach/voice-command-bar.tsx
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

---
## FILE: src/components/nutrition/barcode-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Barcode, Loader2, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FoodItem } from "@/types/nutrition";

export function BarcodeScanner({
  onFound,
  onCreateCustomRequested,
}: {
  onFound: (food: FoodItem) => void;
  onCreateCustomRequested: () => void;
}) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showNotFoundDialog, setShowNotFoundDialog] = useState(false);
  const scannerTargetRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quaggaRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectedHandlerRef = useRef<((result: any) => void) | null>(null);

  const lookupBarcode = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setScanning(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/nutrition/barcode/${encodeURIComponent(code.trim())}`);
        if (res.status === 404) {
          setNotFound(true);
          setShowNotFoundDialog(true);
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Barcode lookup failed");
        }
        const food: FoodItem = await res.json();
        onFound(food);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to look up barcode. Check your connection.";
        toast.error(message);
      } finally {
        setScanning(false);
      }
    },
    [onFound]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (cameraActive) return;

    try {
      const targetEl = scannerTargetRef.current;
      if (!targetEl) {
        setCameraError("Scanner view is not ready. Please try again.");
        return;
      }

      // Ensure scanner target has usable dimensions before Quagga init
      let hasSize = false;
      for (let i = 0; i < 10; i += 1) {
        const rect = targetEl.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) {
          hasSize = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!hasSize) {
        setCameraError("Scanner failed to initialize. Please reopen this screen and try again.");
        return;
      }

      const { default: Quagga } = await import("@ericblade/quagga2");
      quaggaRef.current = Quagga;

      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: targetEl,
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          numOfWorkers:
            typeof navigator !== "undefined" && navigator.hardwareConcurrency
              ? Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))
              : 2,
          frequency: 10,
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "upc_reader",
              "upc_e_reader",
              "code_128_reader",
              "code_39_reader",
            ],
          },
          locate: true,
        },
        (err: Error | null) => {
          if (err) {
            console.error("Quagga init error:", err);
            setCameraError("Could not initialize barcode scanner. Try manual barcode entry.");
            return;
          }
          try {
            Quagga.start();
            setCameraActive(true);
          } catch (startErr) {
            console.error("Quagga start error:", startErr);
            setCameraError("Could not start camera scanner.");
            return;
          }

          let lastCode = "";
          let lastTime = 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handler = (result: any) => {
            const code = result?.codeResult?.code;
            const now = Date.now();
            if (code && (code !== lastCode || now - lastTime > 3000)) {
              lastCode = code;
              lastTime = now;
              lookupBarcode(code);
            }
          };

          detectedHandlerRef.current = handler;
          Quagga.onDetected(handler);
        }
      );
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access and try again.");
      } else {
        setCameraError("Could not access camera. Try using the barcode input below.");
      }
    }
  }, [lookupBarcode, cameraActive]);

  const stopCamera = useCallback(() => {
    if (quaggaRef.current) {
      try {
        if (detectedHandlerRef.current && quaggaRef.current.offDetected) {
          quaggaRef.current.offDetected(detectedHandlerRef.current);
        }
        quaggaRef.current.stop();
      } catch {}
      quaggaRef.current = null;
    }
    detectedHandlerRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      <Dialog open={showNotFoundDialog} onOpenChange={setShowNotFoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Barcode Not Found</DialogTitle>
            <DialogDescription>
              This product was not found. You can create a custom food with your own macros.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotFoundDialog(false)}
            >
              Not Now
            </Button>
            <Button
              onClick={() => {
                setShowNotFoundDialog(false);
                onCreateCustomRequested();
              }}
            >
              Create Custom Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-[4/3] w-full">
        <div
          ref={scannerTargetRef}
          className={`h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&>canvas]:h-full [&>canvas]:w-full ${
            cameraActive ? "opacity-100" : "opacity-0"
          }`}
        />
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
            {cameraError ? (
              <>
                <CameraOff className="size-10 text-muted-foreground" />
                <p className="max-w-[240px] text-center text-sm text-muted-foreground">
                  {cameraError}
                </p>
              </>
            ) : (
              <>
                <Camera className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap to activate camera</p>
              </>
            )}
          </div>
        )}
        {/* Scanning guide overlay */}
        {cameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-64">
              {/* Corner brackets */}
              <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-primary" />
              <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-primary" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary" />
              {/* Scan line animation */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
            </div>
          </div>
        )}
        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Looking up product...
            </Badge>
          </div>
        )}
      </div>

      {/* Camera toggle */}
      <Button
        variant={cameraActive ? "outline" : "default"}
        className="w-full gap-2"
        onClick={cameraActive ? stopCamera : startCamera}
      >
        {cameraActive ? (
          <>
            <CameraOff className="size-4" />
            Stop Camera
          </>
        ) : (
          <>
            <Camera className="size-4" />
            Start Camera
          </>
        )}
      </Button>

      {/* Manual barcode entry */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            or enter barcode manually
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 0012000001628"
          value={barcodeInput}
          onChange={(e) => {
            setBarcodeInput(e.target.value);
            setNotFound(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") lookupBarcode(barcodeInput);
          }}
          className="flex-1"
        />
        <Button
          onClick={() => lookupBarcode(barcodeInput)}
          disabled={scanning || !barcodeInput.trim()}
          className="gap-1.5"
        >
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Barcode className="size-4" />}
          Look Up
        </Button>
      </div>

      {notFound && (
        <p className="text-center text-sm text-destructive">
          Product not found. Try the Search tab to find by name.
        </p>
      )}
    </div>
  );
}
```

---
## FILE: src/components/nutrition/custom-food-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem } from "@/types/nutrition";

export function CustomFoodDialog({
  onCreated,
  initialName,
  openSignal,
}: {
  onCreated: (food: FoodItem) => void;
  initialName?: string;
  openSignal?: number;
}) {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  const [servingAmount, setServingAmount] = useState("1");
  const [servingUnit, setServingUnit] = useState<"g" | "ml" | "oz" | "cup">("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sodiumMg, setSodiumMg] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!name && initialName) setName(initialName);
  }, [initialName, open, name]);

  useEffect(() => {
    if (typeof openSignal === "number") {
      setOpen(true);
    }
  }, [openSignal]);

  function parseNumber(value: string): number | null {
    if (!value.trim()) return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  function convertToGrams(amount: number, unit: "g" | "ml" | "oz" | "cup"): number {
    if (unit === "g") return amount;
    if (unit === "ml") return amount; // Approximation: 1 ml ~ 1 g
    if (unit === "oz") return amount * 28.3495;
    return amount * 240; // Approximation: 1 cup ~ 240 ml ~ 240 g
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Food name is required.");
      return;
    }

    const parsedCalories = parseNumber(calories);
    if (parsedCalories === null || parsedCalories < 0) {
      toast.error("Please enter valid calories.");
      return;
    }

    const parsedProtein = parseNumber(protein);
    const parsedCarbs = parseNumber(carbs);
    const parsedFat = parseNumber(fat);
    const parsedFiber = parseNumber(fiber);
    const parsedSodium = parseNumber(sodiumMg);
    const parsedServingAmount = parseNumber(servingAmount);

    const values = [parsedProtein, parsedCarbs, parsedFat, parsedFiber, parsedSodium];
    if (values.some((v) => v !== null && v < 0)) {
      toast.error("Macros and sodium cannot be negative.");
      return;
    }
    if (parsedServingAmount === null || parsedServingAmount <= 0) {
      toast.error("Serving amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to create custom food.");
        return;
      }

      const servingSizeG = Math.round(
        convertToGrams(parsedServingAmount, servingUnit) * 100
      ) / 100;
      const servingDescription = `${parsedServingAmount} ${servingUnit}`;

      const payload = {
        name: trimmedName,
        brand: brand.trim() || null,
        serving_description: servingDescription,
        serving_size_g: servingSizeG,
        calories_per_serving: Math.round(parsedCalories * 100) / 100,
        protein_g: parsedProtein,
        carbs_g: parsedCarbs,
        fat_g: parsedFat,
        fiber_g: parsedFiber,
        sodium_mg: parsedSodium,
        source: "manual",
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("food_items")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) throw error ?? new Error("Failed to create custom food");

      toast.success("Custom food created.");
      onCreated(data as FoodItem);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create custom food.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Create Custom Food
      </Button>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Create Custom Food
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Food name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Brand (optional)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            placeholder="Serving amount"
            value={servingAmount}
            onChange={(e) => setServingAmount(e.target.value)}
          />
          <Select
            value={servingUnit}
            onValueChange={(value) =>
              setServingUnit(value as "g" | "ml" | "oz" | "cup")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">Grams (g)</SelectItem>
              <SelectItem value="ml">Milliliters (ml)</SelectItem>
              <SelectItem value="oz">Ounces (oz)</SelectItem>
              <SelectItem value="cup">Cups</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Calories*"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Protein (g)"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Carbs (g)"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fat (g)"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fiber (g)"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="Sodium (mg)"
            value={sodiumMg}
            onChange={(e) => setSodiumMg(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Use"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/nutrition/edit-food-dialog.tsx
```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FoodLogEntry {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  food_name?: string;
  food_items?: {
    name: string;
  } | null;
}

interface Props {
  open: boolean;
  entry: FoodLogEntry | null;
  onClose: () => void;
  onSave: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function EditFoodDialog({ open, entry, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<string>(entry?.meal_type ?? "breakfast");
  const [servings, setServings] = useState<string>(String(entry?.servings ?? 1));

  const displayName = entry?.food_name || entry?.food_items?.name || "Food";

  async function handleSave() {
    if (!entry) return;

    setSaving(true);
    try {
      const servingsNum = parseFloat(servings);
      if (servingsNum <= 0) {
        alert("Servings must be greater than 0");
        setSaving(false);
        return;
      }

      await onSave(entry.id, {
        meal_type: mealType,
        servings: servingsNum,
      });

      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Food Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{displayName}</p>

          <div className="space-y-2">
            <Label htmlFor="meal-type">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger id="meal-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              step="0.25"
              min="0.25"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="Servings"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/nutrition/food-log-card.tsx
```tsx
"use client";

import { useState } from "react";
import { Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EditFoodDialog } from "./edit-food-dialog";

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  // Food item details (either flattened or nested)
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: {
    name: string;
    brand: string | null;
    serving_description: string | null;
    serving_size_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    source?: string | null;
  } | null;
}

interface Props {
  entry: FoodLogEntry;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function FoodLogCard({ entry, onDelete, onEdit }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this food entry?")) return;

    setDeleting(true);
    try {
      await onDelete(entry.id);
      toast.success("Food entry deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async (entryId: string, updates: { meal_type: string; servings: number }) => {
    try {
      await onEdit(entryId, updates);
      toast.success("Food entry updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update entry");
      throw err;
    }
  };

  const displayName = entry.food_name || entry.food_items?.name || "Unknown Food";
  const displayBrand = entry.food_brand || entry.food_items?.brand;
  const displayServing = entry.serving_description || entry.food_items?.serving_description || (entry.servings ? `${entry.servings}x serving` : "1 serving");
  const totalFiber = (entry.food_items?.fiber_g ?? 0) * (entry.servings ?? 1);
  const totalSugar = (entry.food_items?.sugar_g ?? 0) * (entry.servings ?? 1);
  const totalSodium = (entry.food_items?.sodium_mg ?? 0) * (entry.servings ?? 1);
  const sourceLabel = entry.food_items?.source;

  return (
    <>
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          {displayBrand && (
            <p className="text-xs text-muted-foreground truncate">{displayBrand}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{displayServing}</p>
          {entry.food_items?.serving_size_g != null && (
            <p className="text-[11px] text-muted-foreground">
              ~{Math.round(entry.food_items.serving_size_g * (entry.servings ?? 1) * 10) / 10}g total
            </p>
          )}

          {(entry.protein_g != null || entry.carbs_g != null || entry.fat_g != null) && (
            <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
              {entry.protein_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(entry.protein_g)}g
                </span>
              )}
              {entry.carbs_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(entry.carbs_g)}g
                </span>
              )}
              {entry.fat_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(entry.fat_g)}g
                </span>
              )}
            </div>
          )}
          {(totalFiber > 0 || totalSugar > 0 || totalSodium > 0) && (
            <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
              {totalFiber > 0 && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(totalFiber)}g
                </span>
              )}
              {totalSugar > 0 && (
                <span>
                  <span className="font-medium text-rose-400">Su</span> {Math.round(totalSugar)}g
                </span>
              )}
              {totalSodium > 0 && (
                <span>
                  <span className="font-medium text-cyan-400">Na</span> {Math.round(totalSodium)}mg
                </span>
              )}
            </div>
          )}
          {sourceLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {sourceLabel}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="font-bold text-foreground text-sm">{Math.round(entry.calories_consumed)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => setEditDialogOpen(true)}
              aria-label="Edit entry"
            >
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete entry"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <EditFoodDialog
        open={editDialogOpen}
        entry={entry}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />
    </>
  );
}
```

---
## FILE: src/components/nutrition/food-log-form.tsx
```tsx
"use client";

import { useState } from "react";
import { X, Check, Loader2, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem, MealType } from "@/types/nutrition";

const mealOptions: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

const servingOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function FoodLogForm({
  food,
  initialMeal,
  onSuccess,
  onCancel,
}: {
  food: FoodItem;
  initialMeal: MealType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState(1);
  const [customServings, setCustomServings] = useState("");
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [loading, setLoading] = useState(false);
  const supabase = useSupabase();

  async function ensurePersistedFoodItemId() {
    if (!food.id.startsWith("off-")) return food.id;

    const payload = {
      barcode: food.barcode ?? null,
      name: food.name,
      brand: food.brand ?? null,
      serving_size_g: food.serving_size_g ?? null,
      serving_description: food.serving_description ?? null,
      calories_per_serving: food.calories_per_serving,
      protein_g: food.protein_g ?? null,
      carbs_g: food.carbs_g ?? null,
      fat_g: food.fat_g ?? null,
      fiber_g: food.fiber_g ?? null,
      sugar_g: food.sugar_g ?? null,
      sodium_mg: food.sodium_mg ?? null,
      source: food.source ?? "openfoodfacts",
    };

    if (payload.barcode) {
      const { data, error } = await supabase
        .from("food_items")
        .upsert(payload, { onConflict: "barcode" })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("Could not persist food item");
      return data.id;
    }

    const { data, error } = await supabase
      .from("food_items")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) throw error ?? new Error("Could not persist food item");
    return data.id;
  }

  const displayServings = customServings ? parseFloat(customServings) : servings;

  const calculatedCalories = Math.round(food.calories_per_serving * displayServings);
  const calculatedProtein = food.protein_g != null ? Math.round(food.protein_g * displayServings * 10) / 10 : null;
  const calculatedCarbs = food.carbs_g != null ? Math.round(food.carbs_g * displayServings * 10) / 10 : null;
  const calculatedFat = food.fat_g != null ? Math.round(food.fat_g * displayServings * 10) / 10 : null;

  async function handleLog() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be signed in to log food.");
        return;
      }

      const foodItemId = await ensurePersistedFoodItemId();

      const { error } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItemId,
        meal_type: meal,
        servings: displayServings,
        calories_consumed: calculatedCalories,
        protein_g: calculatedProtein,
        carbs_g: calculatedCarbs,
        fat_g: calculatedFat,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`${food.name} logged to ${meal}!`);
      onSuccess();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to log food. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{food.name}</p>
          {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
        </div>
        <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={onCancel} aria-label="Cancel" style={{ minHeight: 44, minWidth: 44 }}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Serving size selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Servings</Label>
        <div className="flex flex-wrap gap-2">
          {servingOptions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setServings(s);
                setCustomServings("");
              }}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                servings === s && !customServings
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            placeholder="Custom"
            value={customServings}
            onChange={(e) => {
              setCustomServings(e.target.value);
              if (e.target.value) setServings(1);
            }}
            className="h-9 text-sm"
          />
          <span className="flex items-center text-sm text-muted-foreground px-2">servings</span>
        </div>
      </div>

      {/* Calories preview */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Calories</span>
          <span className="text-lg font-bold text-foreground">{calculatedCalories} kcal</span>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {calculatedProtein != null && (
            <span><span className={MACRO_COLORS.protein}>P</span> {calculatedProtein}g</span>
          )}
          {calculatedCarbs != null && (
            <span><span className={MACRO_COLORS.carbs}>C</span> {calculatedCarbs}g</span>
          )}
          {calculatedFat != null && (
            <span><span className={MACRO_COLORS.fat}>F</span> {calculatedFat}g</span>
          )}
        </div>
      </div>

      {/* Meal type */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Meal</Label>
        <Select value={meal} onValueChange={(v) => setMeal(v as MealType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mealOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <opt.icon className="size-3.5" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleLog} disabled={loading} className="w-full gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Log Food
      </Button>
    </div>
  );
}
```

---
## FILE: src/components/nutrition/food-result-card.tsx
```tsx
"use client";

import { MACRO_COLORS } from "@/lib/constants";
import type { FoodItem } from "@/types/nutrition";

export function FoodResultCard({ food }: { food: FoodItem }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground leading-snug">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {food.serving_description ?? (food.serving_size_g ? `${food.serving_size_g}g` : "1 serving")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{Math.round(food.calories_per_serving)}</p>
          <p className="text-xs text-muted-foreground">kcal</p>
        </div>
      </div>
      {(food.protein_g != null ||
        food.carbs_g != null ||
        food.fat_g != null ||
        food.fiber_g != null ||
        food.sugar_g != null ||
        food.sodium_mg != null) && (
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          {food.protein_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(food.protein_g)}g
            </span>
          )}
          {food.carbs_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(food.carbs_g)}g
            </span>
          )}
          {food.fat_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(food.fat_g)}g
            </span>
          )}
          {food.fiber_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(food.fiber_g)}g
            </span>
          )}
          {food.sugar_g != null && (
            <span>
              <span className="font-medium text-rose-400">Su</span> {Math.round(food.sugar_g)}g
            </span>
          )}
          {food.sodium_mg != null && (
            <span>
              <span className="font-medium text-cyan-400">Na</span> {Math.round(food.sodium_mg)}mg
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/components/nutrition/food-scan-review.tsx
```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FoodScanResult, FoodEstimation } from "@/lib/food-scanner/types";

const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

interface ReviewItem extends FoodEstimation {
  included: boolean;
  multiplier: number;
}

interface FoodScanReviewProps {
  result: FoodScanResult;
  onConfirm: (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>) => void;
  onCancel: () => void;
}

export function FoodScanReview({ result, onConfirm, onCancel }: FoodScanReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    result.items.map((item) => ({ ...item, included: true, multiplier: 1 }))
  );

  const toggleItem = useCallback((idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item)));
  }, []);

  const setMultiplier = useCallback((idx: number, multiplier: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, multiplier } : item)));
  }, []);

  const selectedItems = useMemo(() => items.filter((i) => i.included), [items]);

  const totalCalories = useMemo(
    () => selectedItems.reduce((sum, i) => sum + Math.round(i.estimated_calories * i.multiplier), 0),
    [selectedItems]
  );

  const handleConfirm = useCallback(() => {
    const mapped = selectedItems.map((item) => ({
      food_name: item.food_name,
      calories: Math.round(item.estimated_calories * item.multiplier),
      protein_g: Math.round(item.estimated_protein_g * item.multiplier),
      carbs_g: Math.round(item.estimated_carbs_g * item.multiplier),
      fat_g: Math.round(item.estimated_fat_g * item.multiplier),
    }));
    onConfirm(mapped);
  }, [selectedItems, onConfirm]);

  const confidenceColor = (c: "high" | "medium" | "low") => {
    switch (c) {
      case "high":
        return "bg-emerald-400/15 text-emerald-400";
      case "medium":
        return "bg-amber-400/15 text-amber-400";
      case "low":
        return "bg-red-400/15 text-red-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-black text-foreground">Review Detected Items</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Adjust portions and uncheck items you don&apos;t want to log.
        </p>
      </div>

      {/* Overall notes */}
      {result.overall_notes && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-[12px] text-muted-foreground">{result.overall_notes}</p>
        </div>
      )}

      {/* Item cards */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const scaledCal = Math.round(item.estimated_calories * item.multiplier);
          const scaledP = Math.round(item.estimated_protein_g * item.multiplier);
          const scaledC = Math.round(item.estimated_carbs_g * item.multiplier);
          const scaledF = Math.round(item.estimated_fat_g * item.multiplier);
          const isHighCal = scaledCal > 3000;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border border-border/50 p-4 space-y-3 transition-opacity ${
                item.included ? "bg-card/40" : "bg-card/20 opacity-50"
              }`}
            >
              {/* Top row: checkbox + name + confidence */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(idx)}
                  className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.included
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/40 text-transparent"
                  }`}
                  style={{ minHeight: 44, minWidth: 44, padding: "11px" }}
                >
                  <Check className="size-3" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{item.food_name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.assumed_portion}</p>
                </div>
                <Badge className={`shrink-0 text-[10px] font-bold ${confidenceColor(item.confidence)}`}>
                  {item.confidence}
                </Badge>
              </div>

              {/* Portion multiplier */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Portion
                </label>
                <div className="flex gap-1.5">
                  {PORTION_MULTIPLIERS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(idx, m)}
                      className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                        item.multiplier === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/60 border border-border/50 text-muted-foreground"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Macro badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                  {scaledCal} cal
                </span>
                <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                  {scaledP}g P
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                  {scaledC}g C
                </span>
                <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                  {scaledF}g F
                </span>
              </div>

              {/* High calorie warning */}
              {isHighCal && (
                <div className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-2.5 py-2">
                  <AlertTriangle className="size-3 shrink-0 text-yellow-400" />
                  <p className="text-[11px] font-medium text-yellow-400">
                    Over 3,000 cal for a single item — double-check the portion
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Summary + actions */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
          </p>
          <p className="tabular-nums text-[20px] font-black leading-none text-foreground">
            {totalCalories} <span className="text-[11px] font-semibold text-muted-foreground">cal</span>
          </p>
        </div>

        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={onCancel}>
              <X className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button
              className="w-full gap-2"
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
            >
              <Check className="size-4" />
              Log Selected
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/nutrition/food-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CameraOff, Loader2, Upload, X, ScanLine } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { FoodScanResult } from "@/lib/food-scanner/types";
import { FoodScanReview } from "./food-scan-review";

// ── helpers ──────────────────────────────────────────────────────────────────

function compressImage(dataUrl: string, maxDim = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

type ScanState = "idle" | "cameraActive" | "capturedImage" | "analyzing" | "review";

// ── component ────────────────────────────────────────────────────────────────

export function FoodScanner() {
  const [state, setState] = useState<ScanState>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<FoodScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("cameraActive");
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access.");
      } else {
        setCameraError("Could not access camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const compressed = await compressImage(dataUrl);
    setCapturedImage(compressed);
    stopCamera();
    setState("capturedImage");
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setCapturedImage(compressed);
      setState("capturedImage");
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeFood = useCallback(async () => {
    if (!capturedImage) return;
    setState("analyzing");
    try {
      const res = await fetch("/api/nutrition/food-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage, description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to analyze food");
      }
      const data: FoodScanResult = await res.json();
      setResult(data);
      setState("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze food.");
      setState("capturedImage");
    }
  }, [capturedImage, description]);

  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setDescription("");
    setState("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const handleConfirm = useCallback(async (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>) => {
    try {
      const res = await fetch("/api/nutrition/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, meal_type: "snack" }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to log food");
      }

      toast.success(`Logged ${items.length} item${items.length !== 1 ? "s" : ""}`);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log food");
    }
  }, [reset]);

  // Review mode
  if (state === "review" && result) {
    return (
      <FoodScanReview
        result={result}
        onConfirm={handleConfirm}
        onCancel={reset}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 aspect-[4/3] w-full">
        {capturedImage && state !== "cameraActive" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured food" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${state === "cameraActive" ? "opacity-100" : "opacity-0"}`}
            />
            {state !== "cameraActive" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
                {cameraError ? (
                  <>
                    <CameraOff className="size-10 text-muted-foreground" />
                    <p className="max-w-[240px] text-center text-sm text-muted-foreground">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <ScanLine className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Snap a photo of your food</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {state === "analyzing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Analyzing food...
            </Badge>
          </div>
        )}
      </div>

      {/* Description input */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
          What are you eating? (optional)
        </label>
        <Input
          placeholder="e.g. chicken rice bowl with avocado"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-[13px]"
        />
      </div>

      {/* Controls */}
      {state === "idle" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={startCamera}>
              <Camera className="size-4" />
              Open Camera
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload Photo
            </Button>
          </motion.div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {state === "cameraActive" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => { stopCamera(); setState("idle"); }}>
              <CameraOff className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture
            </Button>
          </motion.div>
        </div>
      )}

      {state === "capturedImage" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <X className="size-4" />
              Retake
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={analyzeFood}>
              <ScanLine className="size-4" />
              Analyze Food
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/components/nutrition/food-search-tab.tsx
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function FoodSearchTab({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestSeqRef.current;
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/nutrition/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Search failed");
        }
        const data: FoodItem[] = await res.json();
        if (requestId === requestSeqRef.current) {
          setResults(data);
        }
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (aborted) return;

        const message = err instanceof Error ? err.message : "Search failed. Please try again.";
        toast.error(message);
        if (requestId === requestSeqRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search foods... (e.g. chicken breast)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No results found for &quot;{query}&quot;
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((food) => (
            <button
              key={food.id}
              className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => onFound(food)}
            >
              <FoodResultCard food={food} />
            </button>
          ))}
        </div>
      )}

      {!loading && query.trim().length < 2 && query.trim().length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Type at least 2 characters to search
        </p>
      )}

      {!loading && query.trim().length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Search for a food item by name or brand
        </p>
      )}
    </div>
  );
}
```

---
## FILE: src/components/nutrition/grocery-list-board.tsx
```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Loader2, RefreshCw, Trash2, Plus, Check, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGroceryStore } from "@/stores/grocery-store";

// ── component ────────────────────────────────────────────────────────────────

export function GroceryListBoard() {
  const {
    currentList, isGenerating, error,
    setList, toggleItem, removeItem, addItem, clearList, setGenerating, setError,
  } = useGroceryStore();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [addingCategory, setAddingCategory] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  // Hydrate store from IDB
  useEffect(() => {
    useGroceryStore.persist.rehydrate();
  }, []);

  const generateList = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/grocery-list", { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to generate grocery list");
      }
      const data = await res.json();
      setList(data);
      toast.success("Grocery list generated!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate list";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [setList, setGenerating, setError]);

  const toggleCategory = useCallback((idx: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleAddItem = useCallback((categoryIdx: number) => {
    if (!newItemName.trim()) return;
    addItem(categoryIdx, newItemName.trim(), "1", "");
    setNewItemName("");
    setAddingCategory(null);
  }, [newItemName, addItem]);

  const startAdding = useCallback((categoryIdx: number) => {
    setAddingCategory(categoryIdx);
    setNewItemName("");
    setTimeout(() => addInputRef.current?.focus(), 50);
  }, []);

  // Sync changes to backend
  const syncToBackend = useCallback(async () => {
    if (!currentList) return;
    try {
      await fetch(`/api/nutrition/grocery-list/${currentList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: currentList.categories }),
      });
    } catch {
      // Silent background sync
    }
  }, [currentList]);

  // Debounced sync on list changes
  useEffect(() => {
    if (!currentList) return;
    const timer = setTimeout(syncToBackend, 1500);
    return () => clearTimeout(timer);
  }, [currentList, syncToBackend]);

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!currentList) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ShoppingCart className="size-8 text-primary" />
        </div>
        <h2 className="mb-2 text-[15px] font-black text-foreground">No Grocery List Yet</h2>
        <p className="mb-6 max-w-[260px] text-[13px] text-muted-foreground">
          Generate a smart grocery list based on your recent food logs and nutrition goals.
        </p>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button className="gap-2" onClick={generateList} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            {isGenerating ? "Generating..." : "Generate My List"}
          </Button>
        </motion.div>
        {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────

  const totalItems = currentList.categories.reduce((s, c) => s + c.items.length, 0);
  const checkedItems = currentList.categories.reduce(
    (s, c) => s + c.items.filter((i) => i.checked).length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Progress</p>
          <p className="tabular-nums text-[13px] font-bold text-foreground">
            {checkedItems}/{totalItems}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: totalItems > 0 ? `${(checkedItems / totalItems) * 100}%` : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {currentList.summary && (
          <p className="mt-2 text-[12px] text-muted-foreground">{currentList.summary}</p>
        )}
      </div>

      {/* Category sections */}
      {currentList.categories.map((cat, catIdx) => {
        const isCollapsed = collapsedCategories.has(catIdx);
        const catChecked = cat.items.filter((i) => i.checked).length;

        return (
          <div key={catIdx} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(catIdx)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
              style={{ minHeight: 44 }}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-[13px] font-bold text-foreground flex-1">{cat.category}</span>
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {catChecked}/{cat.items.length}
              </span>
            </button>

            {/* Items */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 px-2 py-1">
                    {cat.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-2 px-2 py-1.5"
                        style={{ minHeight: 44 }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleItem(catIdx, itemIdx)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            item.checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card/40"
                          }`}
                          style={{ minHeight: 44, minWidth: 44, padding: "10px" }}
                          aria-pressed={item.checked}
                          aria-label={item.checked ? "Uncheck item" : "Check item"}
                        >
                          {item.checked && <Check className="size-3" />}
                        </button>

                        {/* Name + qty */}
                        <div className={`flex-1 min-w-0 ${item.checked ? "line-through opacity-50" : ""}`}>
                          <span className="text-[13px] text-foreground">{item.name}</span>
                          {(item.quantity || item.unit) && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(catIdx, itemIdx)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
                          style={{ minHeight: 44, minWidth: 44, padding: "8px" }}
                          aria-label="Remove item"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add item inline */}
                    {addingCategory === catIdx ? (
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Input
                          ref={addInputRef}
                          placeholder="Item name"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem(catIdx);
                            if (e.key === "Escape") setAddingCategory(null);
                          }}
                          className="h-8 flex-1 text-[13px]"
                        />
                        <Button size="sm" className="h-8 gap-1" onClick={() => handleAddItem(catIdx)}>
                          <Plus className="size-3" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setAddingCategory(null)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startAdding(catIdx)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                        style={{ minHeight: 44 }}
                      >
                        <Plus className="size-3.5" />
                        Add item
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Action bar */}
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            </motion.div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate Grocery List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace your current list with a new one based on your latest food logs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { clearList(); generateList(); }}>
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button variant="outline" size="icon" className="shrink-0">
                <Trash2 className="size-4" />
              </Button>
            </motion.div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Grocery List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all items from your list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearList}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/nutrition/meal-template-sheet.tsx
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SavedMealsList } from "@/components/nutrition/saved-meals-list";
import type { FoodItem, MealTemplate, MealTemplateItem } from "@/types/nutrition";

// Accept the shape used by the nutrition page (with nested food_items)
export interface NutritionPageEntry {
  id: string;
  food_item_id: string;
  meal_type: string;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

export function MealTemplateSheet({
  open,
  onOpenChange,
  currentEntries,
  onLoadTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEntries: NutritionPageEntry[];
  onLoadTemplate: (items: MealTemplateItem[]) => void;
}) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/meal-templates");
      if (res.ok) {
        const json = (await res.json()) as { data: MealTemplate[] };
        setTemplates(json.data);
      }
    } catch {
      toast.error("Failed to load saved meals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleSave = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Enter a name for the meal template");
      return;
    }
    if (currentEntries.length === 0) {
      toast.error("No food entries to save");
      return;
    }

    setSaving(true);
    try {
      const items: MealTemplateItem[] = currentEntries.map((entry) => {
        const fi = entry.food_items;
        return {
          food_item_id: entry.food_item_id ?? null,
          name: fi?.name ?? entry.food_name ?? "Unknown",
          brand: fi?.brand ?? entry.food_brand ?? null,
          servings: entry.servings,
          calories: fi?.calories_per_serving ?? entry.calories_consumed ?? 0,
          protein_g: fi?.protein_g ?? entry.protein_g ?? null,
          carbs_g: fi?.carbs_g ?? entry.carbs_g ?? null,
          fat_g: fi?.fat_g ?? entry.fat_g ?? null,
          serving_description: fi?.serving_description ?? entry.serving_description ?? null,
        };
      });

      const res = await fetch("/api/nutrition/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });

      if (res.ok) {
        toast.success("Meal template saved!");
        setTemplateName("");
        await fetchTemplates();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/nutrition/meal-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleUse = (template: MealTemplate) => {
    onLoadTemplate(template.items);
    onOpenChange(false);
    toast.success(`Loaded "${template.name}" into your log`);
  };

  const previewCalories = currentEntries.reduce((sum, e) => {
    const cal = e.food_items?.calories_per_serving ?? e.calories_consumed ?? 0;
    return sum + cal * e.servings;
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-bold">Saved Meals</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="load" className="mt-2 px-4 pb-4">
          <TabsList className="w-full">
            <TabsTrigger value="load" className="flex-1">
              Load
            </TabsTrigger>
            <TabsTrigger value="save" className="flex-1">
              Save Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load" className="mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SavedMealsList
                templates={templates}
                onUse={handleUse}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>

          <TabsContent value="save" className="mt-3 space-y-4">
            {currentEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] font-semibold">Nothing to save</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Log some food first, then save it as a template.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Template Name
                  </label>
                  <Input
                    placeholder="e.g. Monday Breakfast"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview ({currentEntries.length} item
                    {currentEntries.length !== 1 ? "s" : ""} &middot;{" "}
                    {Math.round(previewCalories)} kcal)
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {currentEntries.map((entry) => {
                      const name =
                        entry.food_items?.name ??
                        entry.food_name ??
                        "Unknown";
                      const cal =
                        (entry.food_items?.calories_per_serving ??
                          entry.calories_consumed ??
                          0) * entry.servings;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="min-w-0 truncate text-foreground">
                            {name}
                            {entry.servings !== 1 && (
                              <span className="ml-1 text-muted-foreground">
                                x{entry.servings}
                              </span>
                            )}
                          </span>
                          <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                            {Math.round(cal)} kcal
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || !templateName.trim()}
                  className="w-full gap-2"
                  size="sm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

---
## FILE: src/components/nutrition/menu-recommendation-sheet.tsx
```tsx
"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Utensils, Lightbulb } from "lucide-react";
import type { MenuScanResult, MenuRecommendation } from "@/lib/menu-scanner/types";

interface MenuRecommendationSheetProps {
  results: MenuScanResult | null;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
  open: boolean;
}

export function MenuRecommendationSheet({ results, remaining, onClose, onLog, open }: MenuRecommendationSheetProps) {
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && results && (
        <SheetContent results={results} remaining={remaining} onClose={onClose} onLog={onLog} />
      )}
    </AnimatePresence>,
    portalTarget
  );
}

function SheetContent({
  results,
  remaining,
  onClose,
  onLog,
}: {
  results: MenuScanResult;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}) {
  const macroPills = [
    { label: "Cal", value: remaining.calories, color: "bg-foreground/10 text-foreground" },
    { label: "P", value: `${remaining.protein_g}g`, color: "bg-blue-400/15 text-blue-400" },
    { label: "C", value: `${remaining.carbs_g}g`, color: "bg-amber-400/15 text-amber-400" },
    { label: "F", value: `${remaining.fat_g}g`, color: "bg-pink-400/15 text-pink-400" },
  ];

  function handleLog(rec: MenuRecommendation) {
    onLog({
      name: rec.name,
      calories: rec.estimated_calories,
      protein_g: rec.estimated_protein_g,
      carbs_g: rec.estimated_carbs_g,
      fat_g: rec.estimated_fat_g,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden glass-surface-modal glass-highlight rounded-t-3xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-0 pt-3">
          <div className="h-1 w-9 rounded-full bg-border/50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-[15px] font-black text-foreground">Menu Picks For You</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Remaining macros bar */}
        <div className="flex gap-2 px-5 pb-4">
          {macroPills.map((p) => (
            <div
              key={p.label}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.color}`}
            >
              <span className="opacity-60">{p.label}</span>
              <span className="tabular-nums">{p.value}</span>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-3">
            {results.top_3_recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
              >
                {/* Name + reason */}
                <div>
                  <div className="flex items-start gap-2">
                    <Utensils className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <h3 className="text-[13px] font-bold text-foreground">{rec.name}</h3>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{rec.reason}</p>
                </div>

                {/* Macro badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                    {rec.estimated_calories} cal
                  </span>
                  <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                    {rec.estimated_protein_g}g P
                  </span>
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                    {rec.estimated_carbs_g}g C
                  </span>
                  <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                    {rec.estimated_fat_g}g F
                  </span>
                </div>

                {/* Modification tip */}
                {rec.modification_tip && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2">
                    <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400" />
                    <p className="text-[11px] text-amber-400">{rec.modification_tip}</p>
                  </div>
                )}

                {/* Log button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLog(rec)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground"
                >
                  Log This
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* Overall tip */}
          {results.overall_tip && (
            <div className="mt-4 rounded-xl border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Overall Tip</p>
              <p className="text-[12px] text-muted-foreground">{results.overall_tip}</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
```

---
## FILE: src/components/nutrition/menu-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CameraOff, Loader2, Upload, X, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MenuScanResult } from "@/lib/menu-scanner/types";
import { MenuRecommendationSheet } from "./menu-recommendation-sheet";
import { createClient } from "@/lib/supabase/client";

// ── helpers ──────────────────────────────────────────────────────────────────

function compressImage(dataUrl: string, maxDim = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

type ScanState = "idle" | "cameraActive" | "capturedImage" | "analyzing" | "result";

// ── component ────────────────────────────────────────────────────────────────

export function MenuScanner() {
  const [state, setState] = useState<ScanState>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<MenuScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [showSheet, setShowSheet] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch today's remaining macros
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      const { data: profile } = await supabase
        .from("profiles")
        .select("calorie_goal, protein_goal_g, carb_goal_g, fat_goal_g")
        .eq("id", user.id)
        .single();
      const { data: logs } = await supabase
        .from("food_log")
        .select("calories_consumed, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59`);

      const eaten = (logs ?? []).reduce(
        (acc, l) => ({
          calories: acc.calories + (l.calories_consumed ?? 0),
          protein_g: acc.protein_g + (l.protein_g ?? 0),
          carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
          fat_g: acc.fat_g + (l.fat_g ?? 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );

      setRemaining({
        calories: Math.max(0, (profile?.calorie_goal ?? 2000) - eaten.calories),
        protein_g: Math.max(0, (profile?.protein_goal_g ?? 150) - eaten.protein_g),
        carbs_g: Math.max(0, (profile?.carb_goal_g ?? 250) - eaten.carbs_g),
        fat_g: Math.max(0, (profile?.fat_goal_g ?? 65) - eaten.fat_g),
      });
    })();
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("cameraActive");
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access.");
      } else {
        setCameraError("Could not access camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const compressed = await compressImage(dataUrl);
    setCapturedImage(compressed);
    stopCamera();
    setState("capturedImage");
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setCapturedImage(compressed);
      setState("capturedImage");
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeMenu = useCallback(async () => {
    if (!capturedImage) return;
    setState("analyzing");
    try {
      const res = await fetch("/api/nutrition/menu-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to analyze menu");
      }
      const data: MenuScanResult = await res.json();
      setResult(data);
      setShowSheet(true);
      setState("result");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze menu.");
      setState("capturedImage");
    }
  }, [capturedImage]);

  const handleLog = useCallback(async (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create food_items entry for this menu item
      const { data: foodItem, error: fiErr } = await supabase
        .from("food_items")
        .insert({
          name: item.name,
          calories_per_serving: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: "menu-scan",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (fiErr || !foodItem) throw fiErr ?? new Error("Failed to create food item");

      // 2. Log into food_log referencing that food_item
      const { error: flErr } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItem.id,
        meal_type: "snack",
        servings: 1,
        calories_consumed: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        logged_at: new Date().toISOString(),
      });
      if (flErr) throw flErr;
      toast.success(`Logged ${item.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log food");
    }
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setShowSheet(false);
    setState("idle");
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 aspect-[4/3] w-full">
        {capturedImage && state !== "cameraActive" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured menu" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${state === "cameraActive" ? "opacity-100" : "opacity-0"}`}
            />
            {state !== "cameraActive" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
                {cameraError ? (
                  <>
                    <CameraOff className="size-10 text-muted-foreground" />
                    <p className="max-w-[240px] text-center text-sm text-muted-foreground">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <Utensils className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Snap a photo of the menu</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {state === "analyzing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Analyzing menu...
            </Badge>
          </div>
        )}
      </div>

      {/* Controls */}
      {state === "idle" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={startCamera}>
              <Camera className="size-4" />
              Open Camera
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload Photo
            </Button>
          </motion.div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {state === "cameraActive" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => { stopCamera(); setState("idle"); }}>
              <CameraOff className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture
            </Button>
          </motion.div>
        </div>
      )}

      {state === "capturedImage" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <X className="size-4" />
              Retake
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={analyzeMenu}>
              <Utensils className="size-4" />
              Analyze Menu
            </Button>
          </motion.div>
        </div>
      )}

      {state === "result" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <Camera className="size-4" />
              Scan Another
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={() => setShowSheet(true)}>
              <Utensils className="size-4" />
              View Results
            </Button>
          </motion.div>
        </div>
      )}

      {/* Overall tip */}
      {result && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tip</p>
          <p className="text-[13px] text-muted-foreground">{result.overall_tip}</p>
        </div>
      )}

      {/* Bottom sheet */}
      <MenuRecommendationSheet
        results={result}
        remaining={remaining}
        onClose={() => setShowSheet(false)}
        onLog={handleLog}
        open={showSheet}
      />
    </div>
  );
}
```

---
## FILE: src/components/nutrition/recent-foods.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function RecentFoods({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    async function loadRecentFoods() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setRecentFoods([]);
          return;
        }

        const { data } = await supabase
          .from("food_log")
          .select(
            "logged_at, food_items(id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, serving_description, serving_size_g, barcode, source)"
          )
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(40);

        const typed = (data ?? []) as Array<{
          logged_at: string;
          food_items: FoodItem | FoodItem[] | null;
        }>;

        const seen = new Set<string>();
        const deduped: FoodItem[] = [];

        for (const row of typed) {
          const food = Array.isArray(row.food_items)
            ? row.food_items[0] ?? null
            : row.food_items;
          if (!food) continue;
          if (seen.has(food.id)) continue;
          seen.add(food.id);
          deduped.push(food);
          if (deduped.length >= 8) break;
        }

        setRecentFoods(deduped);
      } finally {
        setLoading(false);
      }
    }

    loadRecentFoods();
  }, [supabase]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recently Logged
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading recent foods...</p>
        </CardContent>
      </Card>
    );
  }

  if (recentFoods.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recently Logged
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentFoods.map((food) => (
          <button
            key={food.id}
            className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60"
            onClick={() => onFound(food)}
          >
            <FoodResultCard food={food} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/nutrition/saved-meals-list.tsx
```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import type { MealTemplate } from "@/types/nutrition";

export function SavedMealsList({
  templates,
  onUse,
  onDelete,
}: {
  templates: MealTemplate[];
  onUse: (template: MealTemplate) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!templates.length) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-[13px] font-semibold">No saved meals yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Save a meal from your daily log to reuse it quickly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t, idx) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{t.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.items.length} item{t.items.length !== 1 ? "s" : ""} &middot;{" "}
              {Math.round(
                t.items.reduce((sum, i) => sum + i.calories * i.servings, 0)
              )}{" "}
              kcal
            </p>
          </div>
          <button
            onClick={() => onUse(t)}
            className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Use
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deletingId === t.id}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            {deletingId === t.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </motion.div>
      ))}
    </div>
  );
}
```

---
## FILE: src/components/dashboard/calorie-ring.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface CalorieRingProps {
  consumed: number;
  goal: number;
}

export const CalorieRing = React.memo(function CalorieRing({ consumed, goal }: CalorieRingProps) {
  const R = 46;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg
        width="116"
        height="116"
        viewBox="0 0 116 116"
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <filter id="calorie-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          className="stroke-border"
        />
        {/* Glow layer */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="10"
          fill="none"
          stroke={isOver ? "rgb(244 63 94)" : "rgb(52 211 153)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#calorie-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        {/* Progress */}
        <circle
          cx="58"
          cy="58"
          r={R}
          strokeWidth="7"
          fill="none"
          stroke={isOver ? "rgb(244 63 94)" : "rgb(52 211 153)"}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
          {Math.round(consumed)}
        </span>
        <span className="text-[9px] font-semibold text-muted-foreground">kcal</span>
        <span
          className={cn(
            "mt-0.5 tabular-nums text-[9px] font-bold",
            isOver ? "text-rose-400" : "text-emerald-400"
          )}
        >
          {isOver ? "+" : ""}
          {Math.round(isOver ? consumed - goal : remaining)}{" "}
          {isOver ? "over" : "left"}
        </span>
      </div>
    </div>
  );
});
```

---
## FILE: src/components/dashboard/dashboard-card-header.tsx
```tsx
import React from "react";

interface DashboardCardHeaderProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export const DashboardCardHeader = React.memo(function DashboardCardHeader({
  icon,
  title,
  action,
}: DashboardCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
          {icon}
        </div>
        <span className="truncate text-[13px] font-bold text-foreground">{title}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
});
```

---
## FILE: src/components/dashboard/dashboard-content.tsx
```tsx
"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { glassMotionVariants } from "@/lib/motion";

import {
  Dumbbell,
  Apple,
  Flame,
  CalendarDays,
  ChevronRight,
  Trophy,
  Target,
  Clock,
  BarChart3,
  Play,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StreakSection } from "@/components/dashboard/streak-section";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";

import { SmartLauncherWidget } from "@/components/workout/smart-launcher-widget";
import { FatigueLevelCard } from "@/components/dashboard/fatigue-level-card";
import { PodsDashboardCard } from "@/components/pods/pods-dashboard-card";
import { XpProgressBar } from "@/components/profile/xp-progress-bar";
import { WeightLogWidget } from "@/components/dashboard/weight-log-widget";
import { MuscleRecoveryCard } from "@/components/dashboard/muscle-recovery-card";
import { WeeklyReviewModal } from "@/components/dashboard/weekly-review-modal";

import { StatPill } from "@/components/dashboard/stat-pill";
import { MacroBar } from "@/components/dashboard/macro-bar";
import { CalorieRing } from "@/components/dashboard/calorie-ring";
import { ProteinRing } from "@/components/dashboard/protein-ring";
import { SectionCard } from "@/components/dashboard/section-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { useDashboardPhase } from "@/hooks/use-dashboard-phase";

import type { FatigueSnapshot } from "@/lib/fatigue/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardPhase = "morning" | "pre_workout" | "active" | "post_workout" | "evening";

type SessionRow = {
  id: string;
  name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume_kg: number | null;
  status: string;
};

type IntentRow = {
  id: string;
  intent_type: string;
  intent_payload: { suggested_goal?: string; suggested_duration_min?: number } | null;
  intent_for_date: string | null;
  status: string;
};

export interface DashboardContentProps {
  userId: string;
  displayName: string;
  todayFormatted: string;
  todayStr: string;
  level: number;
  xp: number;
  streak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  totalSessionCount: number;
  thisWeekSessionCount: number;
  lastWorkout: SessionRow | null;
  workedOutToday: boolean;
  workedOutYesterday: boolean;
  streakAtRisk: boolean;
  momentumUrgency: "low" | "medium" | "high";
  weeklyMomentumGoal: number;
  weeklyProgressPct: number;
  weeklyAverageSessions: number;
  projectedSessions90d: number;
  projectedVolumeKg: number;
  calorieGoal: number | null;
  todayCalories: number;
  todayProtein: number;
  todayCarbs: number;
  todayFat: number;
  todayFiber: number;
  todaySugar: number;
  todaySodiumMg: number;
  todayServings: number;
  nutritionGoal: {
    calories_target: number | null;
    protein_g_target: number | null;
    carbs_g_target: number | null;
    fat_g_target: number | null;
  } | null;
  activeIntent: IntentRow | null;
  quickAddFoods: Array<{ id: string; name: string; brand: string | null }>;
  fatigueSnapshot: FatigueSnapshot;
  dashboardPhase: DashboardPhase;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function CardDivider() {
  return <div className="h-px bg-border/40" />;
}

// ─── DashboardContent ─────────────────────────────────────────────────────────

export function DashboardContent({
  userId,
  displayName,
  todayFormatted,
  level,
  xp,
  streak,
  milestonesUnlocked,
  freezeAvailable,
  totalSessionCount,
  thisWeekSessionCount,
  lastWorkout,
  workedOutToday,
  workedOutYesterday,
  streakAtRisk,
  momentumUrgency,
  weeklyMomentumGoal,
  weeklyProgressPct,
  weeklyAverageSessions,
  projectedSessions90d,
  projectedVolumeKg,
  calorieGoal,
  todayCalories,
  todayProtein,
  todayCarbs,
  todayFat,
  todayFiber,
  todaySugar,
  todaySodiumMg,
  todayServings,
  nutritionGoal,
  activeIntent,
  quickAddFoods,
  fatigueSnapshot,
  dashboardPhase,
}: DashboardContentProps) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const toDisplayVolume = (kgVolume: number) =>
    preference === "imperial"
      ? Math.round(kgToLbs(kgVolume))
      : Math.round(kgVolume);

  const ninetyDayCard = (
    <SectionCard key="ninetyDay">
      <DashboardCardHeader
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
        title="Future Self · 90-Day Path"
        action={
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {Math.round(weeklyAverageSessions * 10) / 10}/wk avg
          </span>
        }
      />
      <CardDivider />
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Stay on this path to complete
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular-nums text-[40px] font-black leading-none text-primary">
              {projectedSessions90d}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">
              workouts in 90 days
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              7-Day Goal
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
                {thisWeekSessionCount}
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">
                /{weeklyMomentumGoal}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              Proj. Volume
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="tabular-nums text-[18px] font-black leading-none text-foreground">
                {toDisplayVolume(projectedVolumeKg).toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{unitLabel}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Weekly momentum progress
            </span>
            <span className="text-[10px] font-bold text-primary">
              {weeklyProgressPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${weeklyProgressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Consistency compounds. Keep stacking sessions to shift this curve up.
        </p>
      </div>
    </SectionCard>
  );

  const nutritionCard = (
    <SectionCard key="nutrition">
      <DashboardCardHeader
        icon={<Apple className="h-3.5 w-3.5 text-emerald-400" />}
        title="Today's Nutrition"
        action={
          <Link href="/nutrition">
            <button className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-opacity hover:opacity-80">
              Log food
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        }
      />
      <CardDivider />
      <div className="space-y-5 p-5">
        {calorieGoal ? (
          <>
            <div className="flex items-center gap-4">
              <CalorieRing consumed={todayCalories} goal={calorieGoal} />
              {nutritionGoal?.protein_g_target ? (
                <ProteinRing consumed={todayProtein} goal={nutritionGoal.protein_g_target} />
              ) : null}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                    Goal
                  </p>
                  <p className="tabular-nums text-[20px] font-black leading-none text-foreground">
                    {calorieGoal.toLocaleString()}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {" "}kcal
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Remaining</p>
                  <p className="tabular-nums text-[18px] font-black leading-none text-emerald-400">
                    {Math.max(0, calorieGoal - todayCalories).toLocaleString()}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {" "}kcal
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {dashboardPhase === "post_workout" && nutritionGoal?.protein_g_target && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] text-primary font-semibold">
                Recovery window — {Math.max(0, (nutritionGoal.protein_g_target ?? 0) - todayProtein)}g protein remaining
              </div>
            )}

            <div className="space-y-3">
              <MacroBar
                label="Protein"
                value={todayProtein}
                goal={nutritionGoal?.protein_g_target ?? null}
                textColorClass="text-blue-400"
                barColorClass="bg-blue-400"
                trackHeight="h-2"
              />
              <MacroBar
                label="Carbs"
                value={todayCarbs}
                goal={nutritionGoal?.carbs_g_target ?? null}
                textColorClass="text-amber-400"
                barColorClass="bg-amber-400"
              />
              <MacroBar
                label="Fat"
                value={todayFat}
                goal={nutritionGoal?.fat_g_target ?? null}
                textColorClass="text-rose-400"
                barColorClass="bg-rose-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/30 p-3 sm:grid-cols-4">
              {[
                { label: "Fiber", value: `${Math.round(todayFiber)}g`, colorClass: "text-emerald-400" },
                { label: "Sugar", value: `${Math.round(todaySugar)}g`, colorClass: "text-rose-400" },
                { label: "Sodium", value: `${Math.round(todaySodiumMg / 100) / 10}g`, colorClass: "text-cyan-400" },
                { label: "Servings", value: `${Math.round(todayServings * 10) / 10}`, colorClass: "text-violet-400" },
              ].map(({ label, value, colorClass }) => (
                <div key={label} className="text-center">
                  <p className={cn("tabular-nums text-[14px] font-black leading-none", colorClass)}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Set your daily calorie goal to track nutrition here.
            </p>
            <Link href="/nutrition/goals">
              <Button variant="outline" size="sm">Set Goals</Button>
            </Link>
          </div>
        )}
      </div>
    </SectionCard>
  );

  const cardMap: Record<string, React.ReactNode> = {
    launcher: <SmartLauncherWidget key="launcher" />,
    fatigue: <FatigueLevelCard key="fatigue" initialSnapshot={fatigueSnapshot} />,
    muscleRecovery: <MuscleRecoveryCard key="muscleRecovery" />,
    weight: <WeightLogWidget key="weight" />,
    ninetyDay: ninetyDayCard,
    nutrition: nutritionCard,
  };

  const orderedCards = useDashboardPhase(dashboardPhase, cardMap);

  return (
    <div data-phase={dashboardPhase} className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-5 md:px-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl glass-surface-elevated glass-highlight p-6 sm:p-8"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-[80px]" />
        <div className="pointer-events-none absolute -left-16 -bottom-12 h-64 w-64 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 -top-6 h-32 w-96 -translate-x-1/2 bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.10))] blur-2xl" />

        <div className="relative space-y-6">
          {/* Header row */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              {/* Date pill + Level badge */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Date pill with live dot */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{
                      boxShadow: "0 0 6px rgb(52 211 153)",
                      animation: "pulse 2s infinite",
                    }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {todayFormatted}
                  </span>
                </div>
                {/* XP progress bar */}
                <XpProgressBar level={level} xp={xp} />
                {/* Weekly Review */}
                <WeeklyReviewModal
                  streak={streak}
                  weeklySessionCount={thisWeekSessionCount}
                  weeklyMomentumGoal={weeklyMomentumGoal}
                  weeklyProgressPct={weeklyProgressPct}
                  weeklyAverageSessions={weeklyAverageSessions}
                  projectedSessions90d={projectedSessions90d}
                  projectedVolumeKg={projectedVolumeKg}
                  totalSessions={totalSessionCount}
                  unitLabel={unitLabel}
                  toDisplayVolume={toDisplayVolume}
                />
              </div>

              {/* Heading */}
              <div>
                <h1
                  className="font-black leading-[1.1] tracking-tight text-foreground"
                  style={{ fontSize: "clamp(24px, 5vw, 40px)" }}
                >
                  {workedOutToday ? (
                    <>
                      Performance locked,{" "}
                      <span className="text-primary">{displayName}</span>
                    </>
                  ) : (
                    <>
                      Build momentum,{" "}
                      <span className="text-primary">{displayName}</span>
                    </>
                  )}
                </h1>
                <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-muted-foreground">
                  {workedOutToday
                    ? "Session complete. Keep the edge by recovering and logging nutrition precisely."
                    : "Your next session defines the week. Start now and protect your streak."}
                </p>
              </div>
            </div>

            {/* Streak section */}
            <StreakSection
              userId={userId}
              currentStreak={streak}
              milestonesUnlocked={milestonesUnlocked}
              freezeAvailable={freezeAvailable}
              level={level}
            />
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3">
            <StatPill
              icon={<Flame className="h-4 w-4 text-orange-500" />}
              value={streak}
              label="Day Streak"
            />
            <StatPill
              icon={<Dumbbell className="h-4 w-4 text-primary" />}
              value={thisWeekSessionCount}
              label="This Week"
            />
            <StatPill
              icon={<Trophy className="h-4 w-4 text-amber-400" />}
              value={totalSessionCount}
              label="Total"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Link href="/workout">
              <Button className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-bold sm:gap-2 sm:text-sm">
                <Play className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Workout</span>
              </Button>
            </Link>
            <Link href="/nutrition">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-semibold sm:gap-2 sm:text-sm"
              >
                <Apple className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Nutrition</span>
              </Button>
            </Link>
            <Link href="/history/progress">
              <Button
                variant="secondary"
                className="motion-press h-12 w-full justify-center gap-1.5 rounded-xl text-xs font-semibold sm:gap-2 sm:text-sm"
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Progress</span>
              </Button>
            </Link>
          </div>


        </div>
      </motion.section>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">

        {/* Left column – phase-ordered cards */}
        <motion.div
          className="space-y-5"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
        >
          {orderedCards.map((card, i) => (
            <motion.div key={i} variants={glassMotionVariants.glassReveal}>
              {card}
            </motion.div>
          ))}

          {/* Last Workout */}
          <SectionCard>
            <DashboardCardHeader
              icon={<CalendarDays className="h-3.5 w-3.5 text-primary" />}
              title="Last Workout"
              action={
                <Link href="/history">
                  <button className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-opacity hover:opacity-80">
                    View all
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              }
            />
            <CardDivider />
            <div className="p-5">
              {lastWorkout ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-[15px] font-black text-foreground">{lastWorkout.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(lastWorkout.started_at)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400">
                      Completed
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          Duration
                        </span>
                      </div>
                      <span className="tabular-nums text-[20px] font-black leading-none text-foreground">
                        {formatDuration(lastWorkout.duration_seconds)}
                      </span>
                    </div>

                    {lastWorkout.total_volume_kg && (
                      <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                            Volume
                          </span>
                        </div>
                        <span className="tabular-nums text-[20px] font-black leading-none text-foreground">
                          {toDisplayVolume(lastWorkout.total_volume_kg).toLocaleString()}
                          <span className="text-[12px] font-normal text-muted-foreground"> {unitLabel}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No workouts yet. Start your first session.
                  </p>
                  <Link href="/workout">
                    <Button size="sm">
                      <Dumbbell className="mr-2 h-4 w-4" />
                      Start Workout
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </SectionCard>


        </motion.div>

        {/* Right aside */}
        <aside className="space-y-5">
          <PodsDashboardCard />

        </aside>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/dashboard/fatigue-level-card.tsx
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FatigueSnapshot } from "@/lib/fatigue/types";

type Props = {
  initialSnapshot: FatigueSnapshot;
};

function meterTone(value: number): string {
  if (value >= 85) return "text-rose-400";
  if (value >= 70) return "text-orange-400";
  if (value >= 50) return "text-amber-400";
  return "text-emerald-400";
}

export function FatigueLevelCard({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<FatigueSnapshot>(initialSnapshot);
  const [saving, setSaving] = useState(false);
  const [checkin, setCheckin] = useState({
    sleep_quality: 7,
    soreness: 3,
    stress: 3,
    motivation: 8,
  });

  // Use snapshot timezone from the server to avoid hydration mismatch
  // (Intl.DateTimeFormat().resolvedOptions().timeZone differs on server vs client)
  const timezone = snapshot.timezone || "UTC";

  async function handleSubmitCheckin() {
    setSaving(true);
    try {
      const response = await fetch("/api/fatigue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checkin, timezone }),
      });

      if (!response.ok) {
        throw new Error("Could not save check-in");
      }

      const data = await response.json();
      if (data?.snapshot) {
        setSnapshot(data.snapshot as FatigueSnapshot);
      }
      toast.success("Recovery check-in saved.");
    } catch (error) {
      console.error("Check-in save failed:", error);
      toast.error("Failed to save check-in");
    } finally {
      setSaving(false);
    }
  }

  const contributors = [
    {
      key: "load",
      label: "Load",
      value: snapshot.loadSubscore,
      help: "sRPE × duration vs your rolling 7/28 day training load.",
    },
    {
      key: "recovery",
      label: "Recovery",
      value: snapshot.recoverySubscore,
      help: "Sleep, soreness, stress, and motivation from your daily check-in.",
    },
    {
      key: "performance",
      label: "Performance",
      value: snapshot.performanceSubscore,
      help: "Recent performance trend on trained compound lifts at similar effort when available.",
    },
  ] as const;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Fatigue Level
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                Why?
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-xs text-muted-foreground">
              Estimate based on training load, recent performance trends, and recovery check-ins.
              Improves with consistent logging.
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="flex items-end justify-between">
            <p className="text-4xl font-black leading-none tabular-nums">{snapshot.fatigueScore}</p>
            <p className={`text-sm font-semibold ${meterTone(snapshot.fatigueScore)}`}>
              {snapshot.recommendation.label}
            </p>
          </div>
          <Progress value={snapshot.fatigueScore} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{snapshot.recommendation.guidance}</p>
        </div>

        <div className="space-y-2">
          {contributors.map((item) => (
            <div key={item.key} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium">{item.label}</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      {item.value}
                      <CircleHelp className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-xs text-muted-foreground">{item.help}</PopoverContent>
                </Popover>
              </div>
              <Progress value={item.value} className="h-1.5" />
            </div>
          ))}
        </div>

        {!snapshot.hasRecentSessions ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            No recent sessions logged. <Link href="/workout" className="underline">Log a workout</Link> to improve this estimate.
          </div>
        ) : null}

        {snapshot.needsSessionRpe ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Missing session RPE on recent workouts. Add post-session effort ratings for better load accuracy.
          </div>
        ) : null}

        {!snapshot.hasRecoveryCheckin ? (
          <div className="rounded-xl border border-border/60 bg-card/30 p-3 space-y-3">
            <p className="text-xs font-semibold">Quick check-in (today)</p>
            {([
              ["sleep_quality", "Sleep quality"],
              ["soreness", "Soreness"],
              ["stress", "Stress"],
              ["motivation", "Motivation"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">{checkin[field]}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[checkin[field]]}
                  onValueChange={(value) => {
                    setCheckin((prev) => ({ ...prev, [field]: value[0] ?? prev[field] }));
                  }}
                />
              </div>
            ))}
            <Button className="w-full" onClick={handleSubmitCheckin} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Check-in
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/dashboard/level-up-celebration.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    // Stage 1: Radial burst confetti
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FFA500", "#FF6B9D", "#C471ED"],
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Show card after 300ms
    setTimeout(() => {
      setShowCard(true);
    }, 300);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:items-center sm:p-6">
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-sm"
          >
            <Card className="relative max-h-[min(92dvh,42rem)] overflow-y-auto overflow-x-clip rounded-3xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-2xl">
              {/* Animated Background Glow */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{
                  opacity: [0.35, 0.75, 0.35],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Corner glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={onClose}
                aria-label="Close level-up celebration"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Content */}
              <div className="relative text-center space-y-4">
                {/* Level Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-10 w-10 text-primary-foreground" />
                    {[0, 120, 240].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-full w-full"
                        animate={{ rotate: [deg, deg + 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                      >
                        <Star className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-primary" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                    Level Up!
                  </h2>
                  <p className="mt-1 text-3xl font-black tracking-tight">
                    You reached
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New level unlocked.
                  </p>
                </motion.div>

                {/* Level Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                  className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/20 to-accent/20 p-6"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text-7xl font-black tabular-nums text-primary">
                      {newLevel}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Level
                    </span>
                  </div>
                </motion.div>

                {/* Motivational Message */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  You&apos;re getting stronger. Keep stacking sessions.
                </motion.p>

                {/* Continue Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={onClose}
                    className="motion-press w-full rounded-xl"
                    size="lg"
                  >
                    Continue Training
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## FILE: src/components/dashboard/macro-bar.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  value: number;
  goal: number | null;
  textColorClass: string;
  barColorClass: string;
  trackHeight?: string;
}

export const MacroBar = React.memo(function MacroBar({
  label,
  value,
  goal,
  textColorClass,
  barColorClass,
  trackHeight = "h-1",
}: MacroBarProps) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums text-xs font-bold", textColorClass)}>
          {Math.round(value)}g
          {goal && (
            <span className="font-normal text-muted-foreground"> / {goal}g</span>
          )}
        </span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-[var(--glass-tint-medium)]", trackHeight)}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            barColorClass,
            pct > 80 && "shadow-[0_0_8px_currentColor/30]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});
```

---
## FILE: src/components/dashboard/momentum-protection-card.tsx
```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock3, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import {
  logRetentionEvent,
  trackComebackPlanCompleted,
  trackComebackPlanStarted,
} from "@/lib/retention-events";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MomentumProtectionCardProps {
  userId: string;
  urgency: "low" | "medium" | "high";
  workedOutYesterday: boolean;
  freezeAvailable: boolean;
}

export function MomentumProtectionCard({
  userId,
  urgency,
  workedOutYesterday,
  freezeAvailable,
}: MomentumProtectionCardProps) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `retention:momentum_protection_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(dedupeKey, "1");
    }

    void logRetentionEvent(supabase, {
      userId,
      eventType: "momentum_protection_shown",
      sourceScreen: "dashboard",
      metadata: {
        urgency,
        worked_out_yesterday: workedOutYesterday,
        freeze_available: freezeAvailable,
      },
    });
  }, [freezeAvailable, supabase, urgency, userId, workedOutYesterday]);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });
      if (error) throw error;

      if (data === true) {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_used",
          sourceScreen: "dashboard",
          metadata: { urgency },
        });
        void trackComebackPlanCompleted(supabase, userId, {
          channel: "streak_freeze",
          urgency,
        });
        toast.success("Streak freeze activated. Momentum protected for today.");
        router.refresh();
      } else {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_failed",
          sourceScreen: "dashboard",
          metadata: { reason: "not_available", urgency },
        });
        toast.error("No streak freeze available.");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      void logRetentionEvent(supabase, {
        userId,
        eventType: "streak_freeze_failed",
        sourceScreen: "dashboard",
        metadata: { reason: "rpc_error", urgency },
      });
      toast.error("Failed to activate streak freeze.");
    }
  }

  return (
    <Card
      className={`border ${
        urgency === "high"
          ? "border-rose-500/50 bg-rose-500/10"
          : urgency === "medium"
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-primary/40 bg-primary/10"
      }`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Momentum Protection
          </p>
          <p className="mt-1 text-sm font-semibold">
            {urgency === "high"
              ? "Your streak is at risk tonight."
              : workedOutYesterday
                ? "Keep the streak alive with one focused session."
                : "A quick session today restores momentum."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {urgency === "high"
              ? "Log a workout now to avoid losing your current run."
              : "You are closer than you think. Protect the momentum."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {urgency === "high" ? (
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          ) : (
            <Clock3 className="h-4 w-4 text-amber-400" />
          )}
          {freezeAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={handleUseFreeze}
            >
              <Snowflake className="mr-1.5 h-3.5 w-3.5" />
              Use Freeze
            </Button>
          ) : (
            <Link href="/workout">
              <Button
                size="sm"
                className="motion-press h-8 rounded-lg px-3 text-xs"
                onClick={() => {
                  void trackComebackPlanStarted(supabase, userId, {
                    channel: "start_workout",
                    urgency,
                  });
                }}
              >
                Protect
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/dashboard/muscle-recovery-card.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MuscleGroupRecovery,
  RecoveryStatus,
} from "@/lib/fatigue/muscle-group";
import {
  recoveryColor,
  recoveryBarColor,
} from "@/lib/fatigue/muscle-group";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(hours: number | null): string {
  if (hours == null) return "--";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function statusLabel(status: RecoveryStatus): string {
  switch (status) {
    case "recovered":
      return "Recovered";
    case "recovering":
      return "Recovering";
    case "fatigued":
      return "Fatigued";
    case "untrained":
      return "Untrained";
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
      <div className="flex-1">
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
      </div>
      <div className="h-3 w-8 animate-pulse rounded bg-muted/40" />
    </div>
  );
}

// ─── MuscleRecoveryCard ───────────────────────────────────────────────────────

export function MuscleRecoveryCard() {
  const [recoveries, setRecoveries] = useState<MuscleGroupRecovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/fatigue/muscle-groups");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) {
          setRecoveries(json.recoveries ?? []);
        }
      } catch {
        if (!cancelled) setError("Could not load recovery data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden glass-surface glass-highlight rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-[13px] font-bold text-foreground">
            Muscle Recovery
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-3 text-xs text-muted-foreground">
            {error}
          </div>
        ) : recoveries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/20 p-4 text-center text-xs text-muted-foreground">
            No recent workout data. Complete a session to see per-muscle recovery
            status.
          </div>
        ) : (
          <div className="space-y-1">
            {recoveries.map((r) => (
              <div
                key={r.muscleGroup}
                className="flex items-center gap-3 rounded-xl border border-[var(--glass-border-light)] bg-[var(--glass-tint-light)] px-4 py-2.5"
              >
                {/* Muscle name */}
                <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {r.displayName}
                </span>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-tint-medium)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        recoveryBarColor(r.recoveryStatus),
                        r.recoveryStatus === "recovered" && "shadow-[0_0_6px_oklch(0.72_0.18_145_/_0.4)]",
                        r.recoveryStatus === "recovering" && "shadow-[0_0_6px_oklch(0.80_0.15_85_/_0.4)]",
                        r.recoveryStatus === "fatigued" && "shadow-[0_0_6px_oklch(0.65_0.22_25_/_0.4)]",
                      )}
                      style={{ width: `${r.recoveryPct}%` }}
                    />
                  </div>
                </div>

                {/* Recovery percentage */}
                <span
                  className={cn(
                    "w-9 text-right tabular-nums text-[11px] font-bold",
                    recoveryColor(r.recoveryStatus)
                  )}
                >
                  {r.recoveryPct}%
                </span>

                {/* Time since trained */}
                <div className="flex w-10 items-center justify-end gap-0.5 text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="tabular-nums text-[10px] font-medium">
                    {formatTimeSince(r.hoursSinceTrained)}
                  </span>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-1 pt-2">
              {(
                [
                  ["Fatigued", "bg-rose-400"],
                  ["Recovering", "bg-amber-400"],
                  ["Recovered", "bg-emerald-400"],
                ] as const
              ).map(([label, dot]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---
## FILE: src/components/dashboard/pro-upgrade-card.tsx
```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Sparkles, LineChart, ShieldCheck } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProUpgradeCardProps {
  userId: string;
}

export function ProUpgradeCard({ userId }: ProUpgradeCardProps) {
  const supabase = useSupabase();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `conversion:pro_upgrade_card:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    supabase.from("conversion_impressions").insert({
      user_id: userId,
      placement: "dashboard",
      impression_type: "locked_preview",
      variant: "pro_card_v1",
      metadata: {
        module: "analytics_and_coaching",
      },
    }).then(({ error }) => {
      if (error) console.warn("[pro-upgrade-card] impression tracking failed:", error.message);
    });
  }, [supabase, userId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card/85">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Pro Performance Layer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ve built momentum. Unlock coaching-grade trend models and pod competition analytics.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span>Advanced PR trajectory forecasting</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Accountability pod pressure index</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Adaptive fueling recommendations</span>
          </div>
        </div>
        <Link href="/upgrade" className="block">
          <Button className="motion-press w-full" size="sm">
            View Pro Features
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/dashboard/protein-ring.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface ProteinRingProps {
  consumed: number;
  goal: number;
}

export const ProteinRing = React.memo(function ProteinRing({ consumed, goal }: ProteinRingProps) {
  const R = 30;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(1, consumed / goal);
  const offset = CIRC * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <filter id="protein-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="38" cy="38" r={R} strokeWidth="5" fill="none" className="stroke-border" />
        {/* Glow layer */}
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="8"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          opacity={0.2}
          filter="url(#protein-glow)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <circle
          cx="38"
          cy="38"
          r={R}
          strokeWidth="5"
          fill="none"
          stroke="rgb(96 165 250)"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="tabular-nums text-[16px] font-black leading-none text-blue-400">
          {Math.round(consumed)}
        </span>
        <span className="text-[8px] font-semibold text-muted-foreground">
          {isOver ? "over" : "left"}
        </span>
        <span className={cn("tabular-nums text-[8px] font-bold", isOver ? "text-rose-400" : "text-blue-400")}>
          {Math.round(isOver ? consumed - goal : remaining)}g
        </span>
      </div>
    </div>
  );
});
```

---
## FILE: src/components/dashboard/section-card.tsx
```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = React.memo(function SectionCard({ children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden glass-surface glass-highlight rounded-2xl",
        className
      )}
    >
      {children}
    </div>
  );
});
```

---
## FILE: src/components/dashboard/stat-pill.tsx
```tsx
import React from "react";

interface StatPillProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}

export const StatPill = React.memo(function StatPill({ icon, value, label }: StatPillProps) {
  return (
    <div className="flex flex-col items-center justify-center glass-surface glass-highlight rounded-2xl px-2 py-4 text-center sm:px-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[22px] font-black leading-none text-foreground sm:text-[26px]">
        {value}
      </span>
      <span className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[9px]">
        {label}
      </span>
    </div>
  );
});
```

---
## FILE: src/components/dashboard/streak-badge.tsx
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface StreakBadgeProps {
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  onUseFreeze?: () => void;
  className?: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  7: "Week Warrior",
  30: "Monthly Master",
  100: "Centurion",
  365: "Year Champion",
};

const MILESTONE_COLORS: Record<number, string> = {
  7: "from-yellow-500/20 to-amber-500/20 border-yellow-400/30 text-yellow-400",
  30: "from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400",
  100: "from-purple-500/20 to-pink-500/20 border-purple-400/30 text-purple-400",
  365: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-400",
};

export function StreakBadge({
  currentStreak,
  milestonesUnlocked = [],
  freezeAvailable,
  onUseFreeze,
  className,
}: StreakBadgeProps) {
  const [showMilestoneNotification, setShowMilestoneNotification] = useState<number | null>(null);
  const previousMilestonesRef = useRef<number[]>(milestonesUnlocked);

  // Detect new milestone unlocks
  useEffect(() => {
    const newMilestones = milestonesUnlocked.filter(
      (m) => !previousMilestonesRef.current.includes(m)
    );

    if (newMilestones.length > 0) {
      const latestMilestone = Math.max(...newMilestones);
      queueMicrotask(() => {
        setShowMilestoneNotification(latestMilestone);
      });

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setShowMilestoneNotification(null);
      }, 5000);
    }
    previousMilestonesRef.current = milestonesUnlocked;
  }, [milestonesUnlocked]);

  const nextMilestone = [7, 30, 100, 365].find((m) => m > currentStreak) ?? null;
  const daysToNext = nextMilestone ? nextMilestone - currentStreak : null;

  return (
    <div className={cn("relative", className)}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4 space-y-3">
          {/* Streak Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={currentStreak > 0 ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0],
                } : {}}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Flame className="h-6 w-6 text-orange-500" />
              </motion.div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {currentStreak}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">day streak</span>
                </p>
                {daysToNext && (
                  <p className="text-xs text-muted-foreground">
                    {daysToNext} days until {MILESTONE_LABELS[nextMilestone!]}
                  </p>
                )}
              </div>
            </div>

            {/* Freeze Badge */}
            {freezeAvailable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onUseFreeze}
                className="gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                title="Use streak freeze (1x/month)"
              >
                <Snowflake className="h-3 w-3" />
                Freeze
              </Button>
            )}
          </div>

          {/* Milestones Grid */}
          {milestonesUnlocked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[7, 30, 100, 365].map((milestone) => {
                const isUnlocked = milestonesUnlocked.includes(milestone);
                return (
                  <motion.div
                    key={milestone}
                    initial={isUnlocked ? { scale: 0 } : false}
                    animate={isUnlocked ? { scale: 1 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-[10px] font-semibold transition-all",
                        isUnlocked
                          ? `bg-gradient-to-r ${MILESTONE_COLORS[milestone]}`
                          : "border-muted-foreground/30 bg-muted/20 text-muted-foreground opacity-50"
                      )}
                    >
                      {isUnlocked && <Trophy className="h-2.5 w-2.5" />}
                      {milestone}d
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Unlock Notification */}
      <AnimatePresence>
        {showMilestoneNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-10"
          >
            <Card className={cn(
              "border-2 bg-gradient-to-r shadow-lg",
              MILESTONE_COLORS[showMilestoneNotification]
            )}>
              <CardContent className="p-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <div className="text-sm font-semibold">
                  <p>{MILESTONE_LABELS[showMilestoneNotification]} Unlocked!</p>
                  <p className="text-xs opacity-80">{showMilestoneNotification}-day streak</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## FILE: src/components/dashboard/streak-section.tsx
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StreakBadge } from "./streak-badge";
import { LevelUpCelebration } from "./level-up-celebration";
import { useSupabase } from "@/hooks/use-supabase";
import { toast } from "sonner";

interface StreakSectionProps {
  userId: string;
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  level: number;
}

export function StreakSection({
  userId,
  currentStreak,
  milestonesUnlocked,
  freezeAvailable,
  level,
}: StreakSectionProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [showLevelUp, setShowLevelUp] = useState(false);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });

      if (error) throw error;

      if (data) {
        toast.success("Streak freeze activated! Your streak is protected for today.");
        router.refresh();
      } else {
        toast.error("No streak freeze available");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      toast.error("Failed to activate streak freeze");
    }
  }

  return (
    <>
      <StreakBadge
        currentStreak={currentStreak}
        milestonesUnlocked={milestonesUnlocked}
        freezeAvailable={freezeAvailable}
        onUseFreeze={handleUseFreeze}
        className="mt-1"
      />

      {showLevelUp && (
        <LevelUpCelebration
          newLevel={level}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </>
  );
}
```

---
## FILE: src/components/dashboard/weekly-review-modal.tsx
```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Dumbbell, Trophy, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface WeeklyReviewModalProps {
  streak: number;
  weeklySessionCount: number;
  weeklyMomentumGoal: number;
  weeklyProgressPct: number;
  weeklyAverageSessions: number;
  projectedSessions90d: number;
  projectedVolumeKg: number;
  totalSessions: number;
  unitLabel: string;
  toDisplayVolume: (kg: number) => number;
}

function ReviewStat({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-4 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[22px] font-black leading-none text-foreground">
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {subtext && (
        <span className="text-[10px] text-muted-foreground/70">{subtext}</span>
      )}
    </div>
  );
}

export function WeeklyReviewModal({
  streak,
  weeklySessionCount,
  weeklyMomentumGoal,
  weeklyProgressPct,
  weeklyAverageSessions,
  projectedSessions90d,
  projectedVolumeKg,
  totalSessions,
  unitLabel,
  toDisplayVolume,
}: WeeklyReviewModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3" />
        Weekly Review
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="weekly-review-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              key="weekly-review-modal"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] top-auto z-[101] max-h-[85vh] overflow-y-auto rounded-3xl glass-surface-modal glass-highlight sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
            >
              <div className="space-y-5 p-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Weekly Review
                    </p>
                    <h2 className="mt-1 text-[20px] font-black tracking-tight text-foreground">
                      Your Progress
                    </h2>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                </div>

                {/* Consistency Score */}
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Weekly Consistency
                  </p>
                  <p className="mt-2 tabular-nums text-[48px] font-black leading-none text-primary">
                    {weeklyProgressPct}%
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {weeklySessionCount} of {weeklyMomentumGoal} sessions this week
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/40">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, weeklyProgressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <ReviewStat
                    icon={<Flame className="h-4 w-4 text-orange-500" />}
                    label="Day Streak"
                    value={streak}
                  />
                  <ReviewStat
                    icon={<Dumbbell className="h-4 w-4 text-primary" />}
                    label="Avg/Week"
                    value={Math.round(weeklyAverageSessions * 10) / 10}
                  />
                  <ReviewStat
                    icon={<Trophy className="h-4 w-4 text-amber-400" />}
                    label="All-Time"
                    value={totalSessions}
                    subtext="total sessions"
                  />
                  <ReviewStat
                    icon={<Target className="h-4 w-4 text-emerald-400" />}
                    label="90-Day Proj."
                    value={projectedSessions90d}
                    subtext={`${toDisplayVolume(projectedVolumeKg).toLocaleString()} ${unitLabel}`}
                  />
                </div>

                {/* Motivational */}
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
                  Consistency compounds. Every session you log adds momentum to your trajectory.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

---
## FILE: src/components/dashboard/weight-log-widget.tsx
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Scale, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, lbsToKg, weightUnit } from "@/lib/units";

type WeightLog = {
  logged_date: string;
  weight_kg: number;
};

export function WeightLogWidget() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [latest, setLatest] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchLatest = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=1");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLatest(data[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLatest();
    useUnitPreferenceStore.persist.rehydrate();
  }, [fetchLatest]);

  const displayWeight = (kg: number) =>
    `${weightToDisplay(kg, isImperial, 1)} ${weightUnit(isImperial)}`;

  const handleSave = async () => {
    const val = parseFloat(input);
    if (!input || isNaN(val) || val <= 0) return;
    setSaving(true);
    const weight_kg = isImperial ? lbsToKg(val) : val;
    // Use Intl to get today in the user's local timezone (avoids server/client date mismatch)
    const today = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const res = await fetch("/api/body/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logged_date: today, weight_kg }),
    });
    if (res.ok) {
      const data: WeightLog = await res.json();
      setLatest(data);
      setInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-bold">Body Weight</span>
        </div>
        <Link
          href="/body"
          className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          History <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-end gap-3">
        {latest ? (
          <div className="flex-1">
            <p className="text-[26px] font-black leading-none tabular-nums">
              {displayWeight(latest.weight_kg)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Last logged {format(new Date(`${latest.logged_date}T12:00:00`), "MMM d")}
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">No weight logged yet</p>
          </div>
        )}

        {/* Quick log */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder={isImperial ? "165" : "75"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSave()}
            className="h-8 w-20 rounded-lg border border-border/50 bg-background/60 px-2.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving || !input}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[11px] font-bold">{unitLabel}</span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

---
## FILE: src/components/workout/add-exercise-to-template-dialog.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Loader2, X, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCustomExerciseDialog } from "./create-custom-exercise-dialog";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, lbsToKg } from "@/lib/units";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  image_url?: string | null;
  gif_url?: string | null;
  source?: string | null;
}

interface TemplateSet {
  reps: number | null;
  weight_kg: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string, sets: TemplateSet[]) => Promise<void>;
}

function resolveExerciseMediaUrl(
  mediaUrl: string | null | undefined,
  source?: string | null
): string | null {
  if (!mediaUrl) return null;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  if (source === "free-exercise-db") {
    const clean = trimmed.replace(/^\/+/, "");
    return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${clean}`;
  }

  return null;
}

export function AddExerciseToTemplateDialog({ open, onClose, onAdd }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { preference, unitLabel } = useUnitPreferenceStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<TemplateSet[]>([{ reps: 10, weight_kg: null }]);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setExercises([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("id,name,muscle_group,equipment,image_url,gif_url,source")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (error) throw error;
      setExercises(data || []);
    } catch (err) {
      console.error("Failed to search exercises:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd() {
    if (!selectedExercise) return;
    if (sets.some((s) => s.reps === null && s.weight_kg === null)) {
      alert("Each set must have at least reps or weight specified");
      return;
    }

    setSaving(true);
    try {
      await onAdd(selectedExercise.id, sets);
      // Reset form
      setSearchQuery("");
      setSelectedExercise(null);
      setSets([{ reps: 10, weight_kg: null }]);
      setExercises([]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updateSet(index: number, field: "reps" | "weight_kg", value: number | null) {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index));
  }

  function addSet() {
    setSets((prev) => [...prev, { reps: 10, weight_kg: null }]);
  }

  function handleCustomExerciseCreated(exercise: Exercise) {
    // Auto-select the newly created exercise
    setSelectedExercise(exercise);
    setShowCreateDialog(false);
  }

  const toDisplayWeight = (kg: number) =>
    weightToDisplay(kg, preference === "imperial", 1);

  const fromDisplayWeight = (value: number) =>
    preference === "imperial" ? lbsToKg(value) : value;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exercise to Template</DialogTitle>
          </DialogHeader>

        <div className="space-y-4 py-4">
          {!selectedExercise ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="search">Search Exercise</Label>
                <Input
                  id="search"
                  placeholder="e.g. Bench Press, Squat..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateDialog(true)}
              >
                <Sparkles className="size-4 mr-2" />
                Create New Exercise
              </Button>

              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {exercises.length > 0 && (
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <Card
                      key={ex.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelectedExercise(ex)}
                    >
                      <CardContent className="p-3">
                        {(() => {
                          const mediaUrl = resolveExerciseMediaUrl(
                            ex.gif_url ?? ex.image_url,
                            ex.source
                          );
                          return (
                        <div className="flex items-center gap-3">
                          {mediaUrl ? (
                            <Image
                              src={mediaUrl}
                              alt={ex.name}
                              width={48}
                              height={48}
                              unoptimized
                              className="size-12 rounded object-cover bg-muted shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{ex.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ex.muscle_group}
                              {ex.equipment && ` • ${ex.equipment}`}
                            </p>
                          </div>
                        </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!searching && searchQuery && exercises.length === 0 && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No exercises found for &quot;{searchQuery}&quot;
                  </p>
                  <Button
                    variant="default"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Sparkles className="size-4 mr-2" />
                    Create &quot;{searchQuery}&quot;
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{selectedExercise.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedExercise.muscle_group}
                    {selectedExercise.equipment && ` • ${selectedExercise.equipment}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedExercise(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Sets</Label>
                {sets.map((set, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`reps-${idx}`} className="text-xs">
                        Reps
                      </Label>
                      <Input
                        id={`reps-${idx}`}
                        type="number"
                        placeholder="Reps"
                        value={set.reps ?? ""}
                        onChange={(e) =>
                          updateSet(idx, "reps", e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`weight-${idx}`} className="text-xs">
                        Weight ({unitLabel})
                      </Label>
                      <Input
                        id={`weight-${idx}`}
                        type="number"
                        step={preference === "imperial" ? "1" : "0.5"}
                        placeholder="Weight"
                        value={set.weight_kg == null ? "" : toDisplayWeight(set.weight_kg)}
                        onChange={(e) =>
                          updateSet(
                            idx,
                            "weight_kg",
                            e.target.value
                              ? fromDisplayWeight(parseFloat(e.target.value))
                              : null
                          )
                        }
                      />
                    </div>
                    {sets.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSet(idx)}
                        className="h-10"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addSet}
                  className="w-full"
                >
                  <Plus className="size-4 mr-1" />
                  Add Set
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {selectedExercise && (
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Exercise"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <CreateCustomExerciseDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleCustomExerciseCreated}
      />
    </>
  );
}
```

---
## FILE: src/components/workout/create-custom-exercise-dialog.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function CreateCustomExerciseDialog({ open, onClose, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    if (!muscleGroup) {
      toast.error("Please select a muscle group");
      return;
    }
    if (!equipment) {
      toast.error("Please select equipment type");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }

    setCreating(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create exercises");
        return;
      }

      // Generate slug from name (simple kebab-case)
      const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      // Insert the custom exercise
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          name: name.trim(),
          slug: `${slug}-${Date.now()}`, // Add timestamp to ensure uniqueness
          muscle_group: muscleGroup,
          equipment: equipment,
          category: category,
          is_custom: true,
          created_by: user.id,
        })
        .select("id, name, muscle_group, equipment")
        .single();

      if (error) throw error;

      toast.success("Custom exercise created!");
      onCreated(data);

      // Reset form
      setName("");
      setMuscleGroup("");
      setEquipment("");
      setCategory("");
      onClose();
    } catch (err) {
      console.error("Failed to create exercise:", err);
      toast.error("Failed to create exercise");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ex-name">Exercise Name *</Label>
            <Input
              id="ex-name"
              placeholder="e.g. Landmine Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="muscle-group">Muscle Group *</Label>
            <Select value={muscleGroup} onValueChange={setMuscleGroup}>
              <SelectTrigger id="muscle-group">
                <SelectValue placeholder="Select muscle group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chest">Chest</SelectItem>
                <SelectItem value="back">Back</SelectItem>
                <SelectItem value="legs">Legs</SelectItem>
                <SelectItem value="shoulders">Shoulders</SelectItem>
                <SelectItem value="arms">Arms</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="full_body">Full Body</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment">Equipment *</Label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger id="equipment">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barbell">Barbell</SelectItem>
                <SelectItem value="dumbbell">Dumbbell</SelectItem>
                <SelectItem value="cable">Cable</SelectItem>
                <SelectItem value="machine">Machine</SelectItem>
                <SelectItem value="bodyweight">Bodyweight</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compound">Compound</SelectItem>
                <SelectItem value="isolation">Isolation</SelectItem>
                <SelectItem value="cardio">Cardio</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Exercise"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/workout/edit-template-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter(f => f !== "All");

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  primary_muscle_group?: string | null;
  training_block?: string | null;
}

interface Props {
  open: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  onSave: (updates: { name: string; description: string | null; primary_muscle_group: string | null; training_block: string | null }) => Promise<void>;
}

export function EditTemplateDialog({ open, template, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState<string | null>(null);
  const [trainingBlock, setTrainingBlock] = useState("");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setPrimaryMuscleGroup(template.primary_muscle_group ?? null);
      setTrainingBlock(template.training_block ?? "");
    }
  }, [template, open]);

  async function handleSave() {
    if (!name.trim()) {
      alert("Template name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        primary_muscle_group: primaryMuscleGroup,
        training_block: trainingBlock.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this workout..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="training-block">Training Block (optional)</Label>
            <Input
              id="training-block"
              value={trainingBlock}
              onChange={(e) => setTrainingBlock(e.target.value)}
              placeholder="e.g. 6-Week Powerbuilding"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on  = primaryMuscleGroup === val;
                const gc  = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPrimaryMuscleGroup(on ? null : val)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha      : "rgba(255,255,255,0.04)",
                      border:     `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color:      on ? gc.labelColor   : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/workout/exercise-card.tsx
```tsx
"use client";

import { ArrowLeftRight, NotebookPen, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SetRow } from "@/components/workout/set-row";
import { ExerciseSparkline } from "@/components/workout/exercise-sparkline";
import { FormTipsPanel } from "@/components/workout/form-tips-panel";
import { weightToDisplay } from "@/lib/units";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import type { WorkoutExercise, WorkoutSet } from "@/types/workout";

type MuscleGroup = string;

export interface ExerciseCardProps {
  exerciseBlock: WorkoutExercise;
  exerciseIndex: number;
  /** Per-exercise ghost sets from the most recent matching session */
  ghostSets: Array<{ setNumber: number; reps: number | null; weight: number | null }> | undefined;
  /** Previous session sets for this exercise (for PR detection ghost) */
  previousSets: Array<{ reps: number | null; weight: number | null }> | undefined;
  /** Suggested weights per set index */
  suggestedWeights: Record<number, number> | undefined;
  /** Trendline data for sparkline */
  trendline: { weights: number[]; slope: number } | undefined;
  /** Unit preference */
  preference: "metric" | "imperial";
  // Actions
  onUpdateSet: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  onCompleteSet: (exerciseIndex: number, setIndex: number) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onSwapExercise: (exerciseIndex: number) => void;
  onSetExerciseNote: (exerciseIndex: number, note: string) => void;
  onStartRest: (exerciseId: string, exerciseName: string, seconds: number) => void;
}

export function ExerciseCard({
  exerciseBlock,
  exerciseIndex,
  ghostSets,
  previousSets,
  suggestedWeights,
  trendline,
  preference,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
  onSwapExercise,
  onSetExerciseNote,
  onStartRest,
}: ExerciseCardProps) {
  return (
    <Card className="overflow-hidden glass-surface-elevated glass-highlight transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/30 hover:shadow-lg">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-accent" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-[20px] font-semibold tracking-tight">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                {exerciseBlock.exercise.category}
              </Badge>
              {exerciseBlock.exercise.equipment ? (
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                  {EQUIPMENT_LABELS[exerciseBlock.exercise.equipment] ?? exerciseBlock.exercise.equipment}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <p>{exerciseBlock.exercise.name}</p>
              {trendline && (
                <ExerciseSparkline
                  weights={trendline.weights}
                  slope={trendline.slope}
                />
              )}
            </div>
            {previousSets?.length ? (
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                Ghost: last session sets loaded
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-lg font-bold leading-none text-primary">
                {exerciseBlock.sets.filter((set) => set.completed).length}
                <span className="text-sm font-medium text-muted-foreground">/{exerciseBlock.sets.length}</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">sets done</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onSwapExercise(exerciseIndex)}
              aria-label="Swap exercise"
            >
              <ArrowLeftRight className="size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onRemoveExercise(exerciseIndex)}
              aria-label="Remove exercise"
            >
              <X className="size-4 text-destructive" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {/* Form Tips Panel */}
      {exerciseBlock.exercise.form_tips && exerciseBlock.exercise.form_tips.length > 0 && (
        <FormTipsPanel
          exerciseName={exerciseBlock.exercise.name}
          formTips={exerciseBlock.exercise.form_tips}
        />
      )}
      <CardContent className="space-y-3 px-5 pb-5">
        {ghostSets?.length ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-300/80">
              Last Session Set Ladder
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ghostSets
                .slice()
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((ghostSet) => (
                  <span
                    key={`${exerciseBlock.exercise.id}-ghost-${ghostSet.setNumber}`}
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200"
                  >
                    <span className="font-semibold">S{ghostSet.setNumber}</span>
                    <span className="text-cyan-100/90">
                      {ghostSet.weight != null
                        ? preference === "imperial"
                          ? weightToDisplay(ghostSet.weight, true, 1)
                          : ghostSet.weight
                        : "\u2014"} x {ghostSet.reps ?? "\u2014"}
                    </span>
                  </span>
                ))}
            </div>
          </div>
        ) : null}
        {exerciseBlock.sets.map((set, setIndex) => {
          const matchedGhostSet = ghostSets?.find(
            (ghostSet) => ghostSet.setNumber === set.set_number
          );
          return (
            <SetRow
              key={set.id}
              set={set}
              previousSet={previousSets?.[setIndex]}
              ghostSet={
                matchedGhostSet
                  ? {
                    reps: matchedGhostSet.reps,
                    weight: matchedGhostSet.weight,
                  }
                  : undefined
              }
              suggestedWeight={
                suggestedWeights?.[setIndex] ?? null
              }
              autoFocusWeight={setIndex === exerciseBlock.sets.length - 1 && !set.completed}
              onUpdate={(updates) => onUpdateSet(exerciseIndex, setIndex, updates)}
              onComplete={() => onCompleteSet(exerciseIndex, setIndex)}
              onRemove={() => onRemoveSet(exerciseIndex, setIndex)}
              onStartRest={(seconds) => {
                onStartRest(
                  exerciseBlock.exercise.id,
                  exerciseBlock.exercise.name,
                  seconds
                );
              }}
            />
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="w-full transition-all duration-200 hover:scale-[1.01]"
          onClick={() => onAddSet(exerciseIndex)}
        >
          Add Set
        </Button>
        {/* Exercise Notes */}
        <div className="space-y-1.5 pt-1">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <NotebookPen className="h-3 w-3" />
            Exercise notes
          </Label>
          <Textarea
            placeholder="Notes for this exercise (optional)..."
            value={exerciseBlock.notes}
            onChange={(e) => onSetExerciseNote(exerciseIndex, e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/workout/exercise-selection-card.tsx
```tsx
"use client";

import { useState } from "react";
import { ChevronDown, Plus, Zap, TrendingUp, Target } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";

interface PreviousPerformance {
  reps: number | null;
  weight: number | null;
  performedAt?: string | null;
}

interface ExerciseSelectionCardProps {
  exercise: Exercise;
  mediaUrl?: string | null;
  posterUrl?: string | null;
  primaryBenefit: string;
  coachingCues: string[];
  previousPerformance?: PreviousPerformance | null;
  selected: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
}

export function ExerciseSelectionCard({
  exercise,
  primaryBenefit,
  coachingCues,
  previousPerformance,
  selected,
  onSelect,
  onQuickAdd,
}: ExerciseSelectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { preference, unitLabel } = useUnitPreferenceStore();

  const muscleLabel =
    MUSCLE_GROUP_LABELS[exercise.muscle_group as keyof typeof MUSCLE_GROUP_LABELS] ??
    exercise.muscle_group ??
    "General";
  const equipmentLabel =
    (exercise.equipment &&
      EQUIPMENT_LABELS[exercise.equipment as keyof typeof EQUIPMENT_LABELS]) ??
    exercise.equipment ??
    "Bodyweight";

  function formatLastPerformance() {
    if (!previousPerformance) return null;
    const hasWeight = previousPerformance.weight != null;
    const hasReps = previousPerformance.reps != null;
    if (!hasWeight && !hasReps) return null;
    const weight = hasWeight
      ? `${weightToDisplay(previousPerformance.weight ?? 0, preference === "imperial", 1)} ${unitLabel}`
      : "BW";
    const reps = hasReps ? `${previousPerformance.reps}` : "—";
    return `${weight} × ${reps}`;
  }

  function handleRowClick() {
    if (!selected) {
      onSelect();
      setExpanded(true);
    } else {
      setExpanded((v) => !v);
    }
  }

  const lastPerf = formatLastPerformance();

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border transition-all duration-200",
        selected
          ? "border-primary/60 bg-card shadow-[0_0_16px_rgba(255,255,255,0.06)]"
          : "border-border/60 bg-card/50 hover:border-border hover:bg-card/80"
      )}
    >
      {/* ── Main row ── */}
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5">
        {/* Tap area — covers name/badges, not the action buttons */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 focus-visible:outline-none"
        >
          <div
            className={cn(
              "h-8 w-1 shrink-0 rounded-full",
              selected ? "bg-primary" : "bg-border"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {exercise.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="h-4 rounded px-1.5 text-[10px] tracking-wide"
              >
                {muscleLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {equipmentLabel}
              </span>
              {lastPerf && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground">
                    Last:{" "}
                    <span className="font-medium text-foreground/80">{lastPerf}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick add button */}
        <button
          type="button"
          aria-label={`Quick add ${exercise.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          onClick={(e) => {
            e.stopPropagation();
            if (!selected) onSelect();
            setExpanded((v) => !v);
          }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            expanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* ── Expandable details ── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border/40 bg-muted/20 px-4 py-3">
            {primaryBenefit && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Primary Benefit
                </p>
                <p className="mt-0.5 text-xs text-foreground/90">{primaryBenefit}</p>
              </div>
            )}

            {coachingCues.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Coaching Cues
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {coachingCues.slice(0, 2).map((cue, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      · {cue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              className="h-8 w-full justify-between text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd();
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add to Workout
              </span>
              <span className="inline-flex items-center gap-1 text-primary-foreground/70">
                <Zap className="h-3 w-3" />
                <TrendingUp className="h-3 w-3" />
                <Target className="h-3 w-3" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/workout/exercise-sparkline.tsx
```tsx
"use client";

import { memo } from "react";

interface ExerciseSparklineProps {
  weights: number[];
  slope: number;
}

export const ExerciseSparkline = memo(function ExerciseSparkline({
  weights,
  slope,
}: ExerciseSparklineProps) {
  if (weights.length < 2) return null;

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 48;
  const H = 20;

  const pts = weights
    .map(
      (w, i) =>
        `${(i / (weights.length - 1)) * W},${H - ((w - min) / range) * H}`
    )
    .join(" ");

  const color = slope > 0 ? "#22c55e" : slope < 0 ? "#ef4444" : "#6b7280";

  return (
    <svg
      width={W}
      height={H}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
```

---
## FILE: src/components/workout/exercise-swap-sheet.tsx
```tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
import { getMuscleColor } from "@/components/marketplace/muscle-colors";
import { cn } from "@/lib/utils";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface ExerciseSwapSheetProps {
  open: boolean;
  exerciseIndex: number | null;
  /** The exercise being replaced (to pre-select its muscle group tab) */
  currentExercise: Exercise | null;
  onSwap: (exerciseIndex: number, newExercise: Exercise) => void;
  onClose: () => void;
}

export function ExerciseSwapSheet({
  open,
  exerciseIndex,
  currentExercise,
  onSwap,
  onClose,
}: ExerciseSwapSheetProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  // Stable seq counter to discard stale responses
  const searchSeq = useRef(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (open && currentExercise) {
      const mg = currentExercise.muscle_group as MuscleGroup;
      setSelectedMuscleGroup(MUSCLE_GROUPS.includes(mg) ? mg : "chest");
      setSearch("");
    }
  }, [open, currentExercise]);

  // Fetch exercises when muscle group or search changes
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const seq = ++searchSeq.current;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const q = search.trim();
        if (q.length > 0) {
          params.set("query", q);
          params.set("muscle_group", selectedMuscleGroup);
        } else {
          params.set("muscle_group", selectedMuscleGroup);
        }

        const res = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch exercises");

        const data = await res.json();
        if (seq !== searchSeq.current) return;

        const all: Exercise[] = data.exercises ?? [];
        // Filter to selected muscle group when no search query
        const filtered =
          q.length === 0
            ? all.filter((e) => e.muscle_group === selectedMuscleGroup)
            : all;
        setExercises(filtered.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        toast.error("Failed to load exercises");
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, selectedMuscleGroup, search]);

  function handleSelect(exercise: Exercise) {
    if (exerciseIndex == null) return;
    onSwap(exerciseIndex, exercise);
    onClose();
    toast.success(`Swapped to ${exercise.name}`);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex h-[80dvh] flex-col">
        <SheetHeader>
          <SheetTitle>Swap Exercise</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MUSCLE_GROUPS.map((group) => {
            const gc = getMuscleColor(group);
            const active = selectedMuscleGroup === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => {
                  setSelectedMuscleGroup(group);
                  setSearch("");
                }}
                className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all duration-150"
                style={{
                  background: active ? gc.bgAlpha : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? gc.borderAlpha : "rgba(255,255,255,0.08)"}`,
                  color: active ? gc.labelColor : "hsl(var(--muted-foreground))",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {MUSCLE_GROUP_LABELS[group] ?? group}
              </button>
            );
          })}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="mt-2"
          autoFocus
        />

        <ScrollArea className="mt-2 min-h-0 flex-1">
          <div className="space-y-1.5 pr-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : exercises.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">No exercises found.</p>
            ) : (
              exercises.map((exercise) => {
                const isCurrent = exercise.id === currentExercise?.id;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleSelect(exercise)}
                    disabled={isCurrent}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isCurrent
                        ? "cursor-not-allowed border-border/50 bg-card/40 opacity-50"
                        : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{exercise.name}</p>
                      {isCurrent && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ??
                        exercise.muscle_group}
                      {exercise.equipment
                        ? ` · ${EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}`
                        : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="mt-2 border-t border-border/40 pt-2">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---
## FILE: src/components/workout/form-tips-panel.tsx
```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FormTipsPanelProps {
  exerciseName: string;
  formTips: string[] | null;
}

export function FormTipsPanel({ exerciseName, formTips }: FormTipsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!formTips || formTips.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
          Form Tips
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
          >
            {formTips.length}
          </Badge>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-primary/10 px-3 pb-3 pt-2 space-y-2">
          {formTips.map((tip, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="leading-snug">{tip}</p>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent shrink-0" />
            <span>AI-powered tips for <strong className="text-foreground">{exerciseName}</strong> coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/components/workout/plate-calculator.tsx
```tsx
"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { motionDurations, motionEasings } from "@/lib/motion";
import { kgToDisplayValue } from "@/lib/units";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlateCalculatorProps {
  weightKg: number;
}

interface PlateEntry {
  weight: number;
  count: number;
}

interface PlateBreakdown {
  barWeight: number;
  plates: PlateEntry[];
  remainder: number;
}

/* ------------------------------------------------------------------ */
/*  Plate denominations & colors                                       */
/* ------------------------------------------------------------------ */

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LBS_PLATES = [45, 35, 25, 10, 5, 2.5];

const KG_BAR = 20;
const LBS_BAR = 45;

/** Standard plate colors (inline styles per project convention) */
const PLATE_COLORS_KG: Record<number, string> = {
  25: "#dc2626",   // red
  20: "#2563eb",   // blue
  15: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
  1.25: "#d1d5db", // silver
};

const PLATE_COLORS_LBS: Record<number, string> = {
  45: "#dc2626",   // red
  35: "#2563eb",   // blue
  25: "#eab308",   // yellow
  10: "#16a34a",   // green
  5: "#f5f5f5",    // white
  2.5: "#9ca3af",  // gray
};

/** Map plate weight to a proportional height (px) for the visual */
const PLATE_HEIGHT_KG: Record<number, number> = {
  25: 80,
  20: 72,
  15: 64,
  10: 54,
  5: 44,
  2.5: 36,
  1.25: 30,
};

const PLATE_HEIGHT_LBS: Record<number, number> = {
  45: 80,
  35: 72,
  25: 64,
  10: 54,
  5: 44,
  2.5: 36,
};

/* ------------------------------------------------------------------ */
/*  Math: greedy plate calculator                                      */
/* ------------------------------------------------------------------ */

export function calculatePlates(
  totalWeight: number,
  unit: "metric" | "imperial",
): PlateBreakdown | null {
  const barWeight = unit === "imperial" ? LBS_BAR : KG_BAR;
  const denominations = unit === "imperial" ? LBS_PLATES : KG_PLATES;

  if (totalWeight <= 0) return null;

  let perSide = (totalWeight - barWeight) / 2;

  if (perSide < 0) {
    return { barWeight, plates: [], remainder: 0 };
  }

  const plates: PlateEntry[] = [];

  for (const denom of denominations) {
    if (perSide >= denom) {
      const count = Math.floor(perSide / denom);
      plates.push({ weight: denom, count });
      perSide -= count * denom;
    }
  }

  // Round remainder to avoid floating-point artifacts
  const remainder = Math.round(perSide * 1000) / 1000;

  return { barWeight, plates, remainder };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlateCalculator({ weightKg }: PlateCalculatorProps) {
  const preference = useUnitPreferenceStore((s) => s.preference);
  const unitLabel = useUnitPreferenceStore((s) => s.unitLabel);

  const displayWeight =
    preference === "imperial"
      ? kgToDisplayValue(weightKg, 1)
      : weightKg;

  if (weightKg <= 0) return null;

  const result = calculatePlates(displayWeight, preference);

  if (!result) return null;

  const colorMap = preference === "imperial" ? PLATE_COLORS_LBS : PLATE_COLORS_KG;
  const heightMap = preference === "imperial" ? PLATE_HEIGHT_LBS : PLATE_HEIGHT_KG;

  const isAtOrBelowBar = result.plates.length === 0 && result.remainder === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionDurations.panel,
        ease: motionEasings.primary as unknown as [number, number, number, number],
      }}
      className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
    >
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Plate Loading
      </p>

      {/* At-or-below-bar message */}
      {isAtOrBelowBar && (
        <p className="text-sm text-muted-foreground">
          Weight is at or below the barbell ({result.barWeight} {unitLabel}).
          Consider dumbbells or a lighter bar.
        </p>
      )}

      {/* Barbell visual + plate chips */}
      {!isAtOrBelowBar && (
        <>
          {/* CSS barbell visualization (one side) */}
          <div className="flex items-center gap-0.5 overflow-x-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Bar sleeve */}
            <div
              className="h-3 w-10 rounded-l-full"
              style={{ background: "#a1a1aa" }}
            />
            {/* Bar shaft */}
            <div
              className="h-2 w-6"
              style={{ background: "#a1a1aa" }}
            />

            {/* Plates (largest -> smallest, left to right) */}
            {result.plates.map((entry) =>
              Array.from({ length: entry.count }).map((_, i) => (
                <div
                  key={`${entry.weight}-${i}`}
                  className="rounded-sm border border-black/10 flex-shrink-0"
                  style={{
                    width: 14,
                    height: heightMap[entry.weight] ?? 40,
                    background: colorMap[entry.weight] ?? "#6b7280",
                  }}
                />
              )),
            )}

            {/* Bar center */}
            <div
              className="h-2 w-4"
              style={{ background: "#a1a1aa" }}
            />
            <div className="text-[10px] font-medium text-muted-foreground pl-2 whitespace-nowrap">
              per side
            </div>
          </div>

          {/* Chip badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Bar: {result.barWeight} {unitLabel}
            </span>
            {result.plates.map((entry) => (
              <span
                key={entry.weight}
                className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {entry.count}x {entry.weight}
                {unitLabel}
              </span>
            ))}
          </div>

          {/* Remainder warning */}
          {result.remainder > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {result.remainder} {unitLabel} per side cannot be loaded with
                standard plates.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
```

---
## FILE: src/components/workout/quick-start-panel.tsx
```tsx
"use client";

import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import { Label } from "@/components/ui/label";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";

interface QuickStartPanelProps {
  presetId: WorkoutPresetId;
  quickFilter: string;
  onQuickFilterChange: (filter: string) => void;
  onPresetChange: (id: WorkoutPresetId) => void;
}

export function QuickStartPanel({
  presetId,
  quickFilter,
  onQuickFilterChange,
  onPresetChange,
}: QuickStartPanelProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <Label
        htmlFor="preset"
        className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
      >
        Choose a Preset
      </Label>

      {/* Marketplace-style filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {MUSCLE_FILTERS.map((f) => {
          const on = quickFilter === f;
          const mgc = f !== "All" ? getMuscleColor(f) : null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onQuickFilterChange(f)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-150"
              style={{
                background: on
                  ? (mgc ? mgc.bgAlpha : "rgba(200,255,0,0.15)")
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${on
                  ? (mgc ? mgc.borderAlpha : "rgba(200,255,0,0.4)")
                  : "rgba(255,255,255,0.08)"}`,
                color: on
                  ? (mgc ? mgc.labelColor : "hsl(var(--primary))")
                  : "hsl(var(--muted-foreground))",
                fontWeight: on ? 700 : 500,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Filtered preset grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POPULAR_WORKOUTS
          .filter((preset) => quickFilter === "All" || preset.category.toLowerCase() === quickFilter.toLowerCase())
          .map((preset) => {
            const gc = getMuscleColor(preset.category);
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetChange(preset.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70 hover:bg-card"
                  }`}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-semibold leading-snug">{preset.defaultName}</p>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                    style={{
                      background: gc.bgAlpha,
                      color: gc.labelColor,
                      border: `1px solid ${gc.borderAlpha}`,
                    }}
                  >
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {preset.liftNames.length} exercises
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {preset.liftNames.slice(0, 2).map((lift) => (
                    <p key={lift} className="truncate text-[10px] text-muted-foreground/90">
                      {"\u2022"} {lift}
                    </p>
                  ))}
                  {preset.liftNames.length > 2 ? (
                    <p className="text-[10px] text-muted-foreground/80">
                      +{preset.liftNames.length - 2} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        <button
          type="button"
          onClick={() => onPresetChange("custom")}
          className={`rounded-xl border px-3 py-2 text-left transition ${presetId === "custom"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-xs font-semibold">Custom</p>
          <p className="text-[10px] text-muted-foreground">Start empty workout</p>
        </button>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/workout/rest-timer-pill.tsx
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useTimerStore } from "@/stores/timer-store";
import { Pause, Play, X, Plus, Minus, BellOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestTimerPillProps {
  className?: string;
}

export function RestTimerPill({ className }: RestTimerPillProps) {
  const {
    timers,
    lastTickMs,
    pauseTimer,
    resumeTimer,
    stopTimer,
    adjustTime,
    notificationPermission,
    requestNotificationPermission,
  } = useTimerStore(
    useShallow((s) => ({
      timers: s.timers,
      lastTickMs: s.lastTickMs,
      pauseTimer: s.pauseTimer,
      resumeTimer: s.resumeTimer,
      stopTimer: s.stopTimer,
      adjustTime: s.adjustTime,
      notificationPermission: s.notificationPermission,
      requestNotificationPermission: s.requestNotificationPermission,
    }))
  );

  const [isDone, setIsDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  // Preserve exercise name for the "done" banner after the timer is removed from store
  const lastExerciseNameRef = useRef<string>("");
  // Track previous timer ID to detect store removal vs manual dismiss
  const prevTimerIdRef = useRef<string | null>(null);
  // Set when user taps X so we don't show the "done" splash on manual dismiss
  const manuallyDismissedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Single active timer — store enforces max-one
  const timer = timers[0] ?? null;

  // Keep exercise name fresh while the timer exists
  if (timer) lastExerciseNameRef.current = timer.exerciseName;

  const now = lastTickMs || Date.now();
  const remainingSeconds = timer
    ? Math.max(0, Math.ceil((timer.endTime - now) / 1000))
    : 0;

  // ── Auto-close detection ─────────────────────────────────────────────────
  // The store removes the timer the instant it hits 0. We detect the
  // "had a timer → no timer" transition and show a "Rest Complete" splash
  // for 1.8 s before the overlay fully exits. Manual X-dismiss skips it.
  useEffect(() => {
    const prevId = prevTimerIdRef.current;
    const currentId = timer?.id ?? null;

    if (prevId !== null && currentId === null) {
      if (!manuallyDismissedRef.current && !isDone) {
        setIsDone(true);
        const t = setTimeout(() => setIsDone(false), 1800);
        return () => clearTimeout(t);
      }
      manuallyDismissedRef.current = false;
    }

    prevTimerIdRef.current = currentId;
  }, [timer, isDone]);

  // Request notification permission on first timer start
  useEffect(() => {
    if (!mounted || !timer || hasRequestedPermission) return;
    if (notificationPermission === "default") {
      requestNotificationPermission();
      setHasRequestedPermission(true);
    }
  }, [mounted, timer, hasRequestedPermission, notificationPermission, requestNotificationPermission]);

  // ── Ring geometry ────────────────────────────────────────────────────────
  const SIZE = 132;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const totalSeconds = timer?.totalSeconds ?? 0;
  const progress =
    totalSeconds > 0 ? Math.min(1, (totalSeconds - remainingSeconds) / totalSeconds) : 1;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const ringColor = isDone
    ? "#22c55e"
    : remainingSeconds <= 10
    ? "#ef4444"
    : remainingSeconds <= 30
    ? "#f59e0b"
    : "hsl(var(--primary))";

  const isRunning = timer?.isRunning ?? false;
  const visible = mounted && (timer !== null || isDone);

  function handleDismiss() {
    if (!timer) return;
    manuallyDismissedRef.current = true;
    stopTimer(timer.id);
  }

  // Portal to document.body so `position: fixed` works correctly even when
  // a parent has a CSS transform (e.g. PageTransition's will-change-transform).
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {/* Soft backdrop — pointer-events-none so the workout page stays usable */}
          <motion.div
            key="rest-timer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[89] bg-background/50 backdrop-blur-[2px] pointer-events-none"
          />

          {/* Centered card */}
          <motion.div
            key="rest-timer-card"
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 14, transition: { duration: 0.22 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "fixed left-1/2 top-1/2 z-[90] -translate-x-1/2 -translate-y-1/2",
              "w-[calc(100%-2.5rem)] max-w-[320px]",
              className
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border bg-card shadow-2xl",
                isDone
                  ? "border-green-500/30"
                  : isRunning
                  ? "border-primary/30"
                  : "border-border/60"
              )}
            >
              {/* Running glow strip */}
              <AnimatePresence>
                {isRunning && !isDone && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0 top-0 h-0.5 rounded-t-3xl"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
                    }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {/* ── Done splash ──────────────────────────────────────── */}
                {isDone ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="flex flex-col items-center gap-3 px-6 py-10"
                  >
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 440, damping: 20, delay: 0.05 }}
                    >
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </motion.div>
                    <p className="text-[20px] font-black tracking-tight text-foreground">
                      Rest Complete!
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {lastExerciseNameRef.current}
                    </p>
                  </motion.div>
                ) : (
                  /* ── Active timer ────────────────────────────────────── */
                  <motion.div
                    key="active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center px-5 pb-5 pt-4"
                  >
                    {/* Header: exercise name + dismiss */}
                    <div className="mb-4 flex w-full items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Rest Timer
                        </p>
                        <p className="mt-0.5 truncate text-[14px] font-bold leading-tight text-foreground">
                          {timer?.exerciseName}
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleDismiss}
                        aria-label="Dismiss timer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>

                    {/* Clock ring */}
                    <div className="relative mb-4" style={{ width: SIZE, height: SIZE }}>
                      <svg
                        width={SIZE}
                        height={SIZE}
                        viewBox={`0 0 ${SIZE} ${SIZE}`}
                        style={{ transform: "rotate(-90deg)" }}
                      >
                        {/* Track */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={5.5}
                          opacity={0.1}
                          className="text-foreground"
                        />
                        {/* Progress arc */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={5.5}
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference * (1 - progress)}
                          style={{
                            transition:
                              "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease",
                          }}
                        />
                      </svg>

                      {/* Time + label inside ring */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          role="timer"
                          aria-label={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`}
                          className="tabular-nums text-[34px] font-black leading-none tracking-tight transition-colors duration-300"
                          style={{ color: ringColor }}
                        >
                          {formatTime(remainingSeconds)}
                        </span>
                        <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {isRunning ? "resting" : "paused"}
                        </span>
                      </div>
                    </div>

                    {/* ±15 s adjust */}
                    <div className="mb-3 flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => timer && adjustTime(timer.id, -15)}
                        aria-label="Subtract 15 seconds"
                        className="flex h-9 items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                        <span>15s</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => timer && adjustTime(timer.id, 15)}
                        aria-label="Add 15 seconds"
                        className="flex h-9 items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        <span>15s</span>
                      </motion.button>
                    </div>

                    {/* Pause / Resume */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        if (!timer) return;
                        isRunning ? pauseTimer(timer.id) : resumeTimer(timer.id);
                      }}
                      aria-label={isRunning ? "Pause timer" : "Resume timer"}
                      className={cn(
                        "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all",
                        isRunning
                          ? "border border-primary/20 bg-primary/10 text-primary"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {isRunning ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Resume
                        </>
                      )}
                    </motion.button>

                    {/* Screen-reader announcements at key thresholds */}
                    <span aria-live="polite" aria-atomic="true" className="sr-only">
                      {remainingSeconds === 0
                        ? `${timer?.exerciseName} rest complete`
                        : remainingSeconds === 30 || remainingSeconds === 10
                        ? `${remainingSeconds} seconds remaining`
                        : ""}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notification-denied banner */}
              <AnimatePresence>
                {notificationPermission === "denied" && !isDone && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 border-t border-amber-400/20 bg-amber-400/[0.06] px-4 py-2">
                      <BellOff className="h-3 w-3 shrink-0 text-amber-400" />
                      <span className="text-[10px] leading-snug text-muted-foreground">
                        Notifications blocked — enable in browser settings for alerts.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

---
## FILE: src/components/workout/save-template-dialog.tsx
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveTemplateSchema, type SaveTemplateFormData } from "@/lib/schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/template-utils";
import { MUSCLE_FILTERS, getMuscleColor } from "@/components/marketplace/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter((f) => f !== "All");

interface Props {
  open: boolean;
  defaultName?: string;
  defaultCategories?: string[];
  onClose: () => void;
  onSave: (name: string, isPublic: boolean, difficulty: DifficultyLevel, categories: string[]) => Promise<void>;
}

export function SaveTemplateDialog({ open, defaultName = "", defaultCategories = [], onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("grind");
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<SaveTemplateFormData>({
    resolver: zodResolver(saveTemplateSchema),
    defaultValues: { name: defaultName },
  });

  const onSubmit = async (data: SaveTemplateFormData) => {
    setLoading(true);
    try {
      await onSave(data.name.trim(), isPublic, difficulty, categories);
      reset();
      setIsPublic(true);
      setDifficulty("grind");
      setCategories([]);
      onClose();
    } catch (err) {
      setError("name", {
        type: "manual",
        message: err instanceof Error ? err.message : "Failed to save template.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      setIsPublic(true);
      setDifficulty("grind");
      setCategories([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Push Day A"
              autoFocus
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          {/* Category picker — multi-select */}
          <div className="space-y-2">
            <Label>
              Workout Type
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                (select one or more)
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on = categories.includes(val);
                const gc = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategories((prev) =>
                        on ? prev.filter((c) => c !== val) : [...prev, val]
                      );
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha : "rgba(255,255,255,0.04)",
                      border: `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color: on ? gc.labelColor : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty picker */}
          <div className="space-y-2">
            <Label>Difficulty Level</Label>
            <div className="grid gap-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setDifficulty(level.value)}
                  className={`rounded-lg border-2 p-2.5 text-left transition-all ${
                    difficulty === level.value
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-card/20 hover:border-border/60"
                  }`}
                >
                  <p className="font-semibold text-sm">{level.label}</p>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Share to Marketplace</p>
              <p className="text-xs text-muted-foreground">Let others discover and save this workout</p>
            </div>
            <Switch
              id="tpl-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => {
              reset();
              setIsPublic(true);
              setCategories([]);
              onClose();
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/workout/set-row.tsx
```tsx
"use client";

import { memo } from "react";
import { Check, Flame, Ghost, Play, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkoutSet } from "@/types/workout";
import { cn } from "@/lib/utils";
import { REST_PRESETS } from "@/lib/constants";
import { motion } from "framer-motion";
import { KG_TO_LBS } from "@/lib/units";
import { celebratePR, triggerHaptic } from "@/lib/celebrations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

interface SetRowProps {
  set: WorkoutSet;
  previousSet?: {
    reps: number | null;
    weight: number | null;
  };
  ghostSet?: {
    reps: number | null;
    weight: number | null;
  };
  /** Display-only suggested weight in kg (never written to store) */
  suggestedWeight?: number | null;
  autoFocusWeight?: boolean;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
  onStartRest?: (seconds: number) => void;
}

const setTypeColors: Record<string, string> = {
  warmup: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  working: "bg-primary/20 text-primary border-primary/30",
  dropset: "bg-accent text-accent-foreground border-primary/30",
  failure: "bg-destructive/20 text-destructive border-destructive/30",
};

export const SetRow = memo(function SetRow({
  set,
  previousSet,
  ghostSet,
  suggestedWeight = null,
  autoFocusWeight = false,
  onUpdate,
  onComplete,
  onRemove,
  onStartRest,
}: SetRowProps) {
  const { preference, unitLabel } = useUnitPreferenceStore();

  // Conversion helpers — all DB values are true kg
  const toDisplay = (kg: number) =>
    preference === "imperial"
      ? Math.round(kg * KG_TO_LBS * 10) / 10
      : Math.round(kg * 100) / 100;
  const fromDisplay = (val: number) =>
    preference === "imperial" ? val / KG_TO_LBS : val;

  const restSeconds = set.rest_seconds ?? 90;
  const weightValue =
    set.weight_kg === null ? "" : String(toDisplay(set.weight_kg));
  const repsValue = set.reps === null ? "" : String(set.reps);
  const rirValue = set.rir === null ? "" : String(set.rir);

  const handleComplete = () => {
    onComplete();

    // Enhanced haptic feedback
    triggerHaptic(beatPrevious ? "heavy" : "light");

    // Celebrate PR immediately with confetti
    if (beatPrevious && !set.completed) {
      celebratePR();
    }

    // Start rest timer if completing (not un-completing)
    if (!set.completed && onStartRest) {
      onStartRest(restSeconds);
    }
  };

  const handleWeightChange = (value: string) => {
    if (value === "") {
      onUpdate({ weight_kg: null });
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      onUpdate({ weight_kg: fromDisplay(parsed) });
    }
  };

  const handleRepsChange = (value: string) => {
    if (value === "") {
      onUpdate({ reps: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate({ reps: parsed });
    }
  };

  const handleRirChange = (value: string) => {
    if (value === "") {
      onUpdate({ rir: null });
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      onUpdate({ rir: Math.max(0, Math.min(10, parsed)) });
    }
  };

  const currentScore =
    set.weight_kg != null && set.reps != null ? set.weight_kg * set.reps : null;

  // PR logic:
  // 1) Weight PR: more weight than previous, regardless of reps.
  // 2) Rep PR: same weight, more reps than previous.
  const previousWeight = previousSet?.weight ?? null;
  const previousReps = previousSet?.reps ?? null;
  const currentWeight = set.weight_kg;
  const currentReps = set.reps;
  const hasComparablePrevious = previousWeight != null && previousReps != null;
  const hasComparableCurrent = currentWeight != null && currentReps != null;
  const weightPR =
    hasComparablePrevious &&
    hasComparableCurrent &&
    currentWeight > previousWeight;
  const repPRAtSameWeight =
    hasComparablePrevious &&
    hasComparableCurrent &&
    currentWeight === previousWeight &&
    currentReps > previousReps;
  const beatPrevious = Boolean(weightPR || repPRAtSameWeight);

  // Ghost workout comparison (from last time doing this template)
  const ghostScore =
    ghostSet?.weight != null && ghostSet.reps != null
      ? ghostSet.weight * ghostSet.reps
      : null;
  const ghostWeightPR =
    ghostSet?.weight != null && set.weight_kg != null && set.weight_kg > ghostSet.weight;
  const ghostRepPRAtSameWeight =
    ghostSet?.weight != null &&
    ghostSet?.reps != null &&
    set.weight_kg != null &&
    set.reps != null &&
    set.weight_kg === ghostSet.weight &&
    set.reps > ghostSet.reps;
  const beatGhost = Boolean(ghostWeightPR || ghostRepPRAtSameWeight);
  const ghostPercentage =
    ghostScore != null && currentScore != null && ghostScore > 0
      ? Math.round((currentScore / ghostScore) * 100)
      : null;
  const ghostWeightText = ghostSet?.weight != null ? `${toDisplay(ghostSet.weight)}` : "—";
  const ghostRepsText = ghostSet?.reps != null ? `${ghostSet.reps}` : "—";
  const previousWeightText = previousSet?.weight != null ? `${toDisplay(previousSet.weight)}` : "—";
  const previousRepsText = previousSet?.reps != null ? `${previousSet.reps}` : "—";
  const currentWeightText = set.weight_kg != null ? `${toDisplay(set.weight_kg)}` : "—";
  const currentRepsText = set.reps != null ? `${set.reps}` : "—";

  return (
    <motion.div
      animate={set.completed ? {
        boxShadow: ["0 0 0px transparent", "0 0 16px 2px var(--phase-active-glow, oklch(0.78 0.16 195 / 0.20))", "0 0 0px transparent"],
      } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "space-y-2.5 rounded-xl border border-border/60 px-3.5 py-3 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        set.completed
          ? "bg-primary/12 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
          : "bg-secondary/40 hover:border-primary/40 hover:bg-secondary/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-muted px-2 text-sm font-semibold text-foreground">
            {set.set_number}
          </span>

          <button
            onClick={() => {
              const types: WorkoutSet["set_type"][] = [
                "warmup",
                "working",
                "dropset",
                "failure",
              ];
              const currentIdx = types.indexOf(set.set_type);
              const nextType = types[(currentIdx + 1) % types.length];
              onUpdate({ set_type: nextType });
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
              setTypeColors[set.set_type]
            )}
          >
            {set.set_type === "working" ? "work" : set.set_type}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            animate={set.completed && (beatPrevious || beatGhost) ? { scale: [1, 1.15, 1] } : {}}
            transition={
              set.completed && (beatPrevious || beatGhost)
                ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                : { type: "spring", stiffness: 400, damping: 15 }
            }
          >
            <Button
              variant={set.completed ? "default" : "secondary"}
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 select-none transition-all duration-300",
                set.completed && beatPrevious
                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse"
                  : set.completed && beatGhost
                    ? "bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    : set.completed && "bg-primary text-primary-foreground"
              )}
              onClick={handleComplete}
              title={
                beatPrevious && set.completed
                  ? weightPR
                    ? "Weight PR!"
                    : "Rep PR!"
                  : beatGhost && set.completed
                    ? "Beat your ghost!"
                    : undefined
              }
            >
              <motion.div
                initial={false}
                animate={{ scale: set.completed ? 1 : 0.8, rotate: set.completed ? 0 : -45 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {set.completed && beatPrevious ? (
                  <Trophy className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </motion.div>
            </Button>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Ghost workout indicator */}
      {ghostSet && !set.completed && (ghostSet.weight != null || ghostSet.reps != null) && (
        <div className="space-y-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-cyan-400/70">
              <Ghost className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Previous:</span>
              <span className="font-semibold tabular-nums">
                {ghostWeightText} × {ghostRepsText}
              </span>
            </span>
            {ghostPercentage != null && ghostPercentage < 100 && (
              <span className="text-muted-foreground">
                {ghostPercentage}% of ghost
              </span>
            )}
          </div>
          {suggestedWeight != null && (
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="font-medium text-amber-400/80">Suggested:</span>
              <span className="font-bold tabular-nums text-amber-400">
                {toDisplay(suggestedWeight)} {unitLabel}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)]">
        <div className="space-y-1">
          <label
            htmlFor={`weight-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Weight ({unitLabel})
          </label>
          <Input
            id={`weight-${set.id}`}
            autoFocus={autoFocusWeight}
            type="number"
            inputMode="decimal"
            placeholder={suggestedWeight != null ? String(toDisplay(suggestedWeight)) : "0"}
            value={weightValue}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`reps-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Reps
          </label>
          <Input
            id={`reps-${set.id}`}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={repsValue}
            onChange={(e) => handleRepsChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`rir-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            RIR
          </label>
          <Input
            id={`rir-${set.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            placeholder="—"
            value={rirValue}
            onChange={(e) => handleRirChange(e.target.value)}
            className="h-10 w-full text-center text-[18px] font-semibold tabular-nums text-foreground"
            disabled={set.completed}
          />
        </div>

        <div className="space-y-1">
          <p
            id={`rest-label-${set.id}`}
            className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Rest
          </p>
          <div className="flex items-center gap-1">
            <Select
              value={String(restSeconds)}
              onValueChange={(value) => onUpdate({ rest_seconds: Number.parseInt(value, 10) })}
            >
              <SelectTrigger className="h-10 w-full" aria-labelledby={`rest-label-${set.id}`}>
                <SelectValue placeholder="Rest" />
              </SelectTrigger>
              <SelectContent>
                {REST_PRESETS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {seconds}s rest
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onStartRest?.(restSeconds)}
              title="Start rest timer for this set"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {previousSet && (previousSet.weight != null || previousSet.reps != null) ? (
        <div className={cn(
          "flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition-all duration-300",
          beatPrevious && set.completed
            ? "border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10"
            : "border-border/50 bg-muted/30"
        )}>
          <span className="text-muted-foreground">
            LAST: <span className="font-medium text-foreground">{previousWeightText} x {previousRepsText}</span>
            {(set.weight_kg != null || set.reps != null) ? (
              <>
                <span className="mx-1.5 text-muted-foreground/70">•</span>
                TODAY: <span className={cn(
                  "font-medium",
                  beatPrevious && set.completed ? "text-yellow-400" : "text-foreground"
                )}>{currentWeightText} x {currentRepsText}</span>
              </>
            ) : null}
          </span>
          {beatPrevious && set.completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-2 py-0.5 font-bold text-black">
              <Trophy className="h-3 w-3" />
              PR
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
});
```

---
## FILE: src/components/workout/smart-launcher-widget.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, ChevronRight, Loader2, Clock } from "lucide-react";
import { logger } from "@/lib/logger";
import { getCachedPrediction, cachePrediction, clearExpiredCache } from "@/lib/launcher-cache";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LauncherPrediction } from "@/types/adaptive";

interface AlternativeTemplate {
  id: string;
  name: string;
  exercise_count: number;
  last_used_at: string;
}

interface LauncherResponse {
  suggested_workout: LauncherPrediction;
  alternative_templates: AlternativeTemplate[];
}

export function SmartLauncherWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<LauncherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    async function fetchLauncher() {
      try {
        // Clear expired cache entries on mount
        clearExpiredCache().catch((e) => logger.error('[Launcher] Cache cleanup failed:', e));

        // Get current user ID from auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          logger.error('[Launcher] No authenticated user');
          setLoading(false);
          return;
        }

        // Check cache first
        const cached = await getCachedPrediction(user.id) as LauncherResponse | null;
        if (cached) {
          logger.log('[Launcher] Serving from cache');
          setData(cached);
          setLoading(false);
        }

        // Fetch from API
        const res = await fetch("/api/workout/launcher");
        if (res.status === 403) {
          // Feature not enabled - hide widget
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load launcher");

        const json = await res.json() as LauncherResponse;

        // Update cache with fresh data
        setData(json);
        await cachePrediction(user.id, json);

        if (!cached) {
          // Only stop loading if we didn't show cached data
          setLoading(false);
        }
      } catch (err) {
        logger.error("Launcher fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    }
    fetchLauncher();
  }, []);

  async function handleStartWorkout(templateId: string | null, accepted: boolean) {
    setStarting(true);
    const startTime = Date.now();

    try {
      // Log acceptance/rejection
      await fetch("/api/workout/launcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          accepted,
          time_to_decision_ms: Date.now() - startTime,
        }),
      });

      // For saved templates: pass template_id in URL
      if (templateId) {
        router.push(`/workout?template_id=${templateId}&from_launcher=true`);
      } else {
        // For preset workouts: store in sessionStorage
        if (data?.suggested_workout) {
          sessionStorage.setItem('launcher_prediction', JSON.stringify(data.suggested_workout));
        }
        router.push("/workout?from_launcher=true");
      }
    } catch (err) {
      logger.error("Failed to start workout:", err);
      setStarting(false);
    }
  }

  // Hide widget if feature not enabled or error
  if (!loading && (!data || error)) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const { suggested_workout, alternative_templates } = data!;
  const confidence = suggested_workout.confidence;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Launcher
          </CardTitle>
          <Badge
            variant={
              confidence === "high"
                ? "default"
                : confidence === "medium"
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            {confidence === "high" ? "High Match" : confidence === "medium" ? "Good Match" : "Suggested"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">{suggested_workout.template_name}</p>
          <p className="text-xs text-muted-foreground">{suggested_workout.reason}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {suggested_workout.exercises.length} exercises
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{suggested_workout.estimated_duration_mins} min
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => handleStartWorkout(suggested_workout.template_id, true)}
            disabled={starting}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Start Workout
              </>
            )}
          </Button>

          {alternative_templates.length > 0 && (
            <Sheet open={showAlternatives} onOpenChange={setShowAlternatives}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" disabled={starting}>
                  Swap
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Alternative Templates</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {alternative_templates.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => {
                        setShowAlternatives(false);
                        handleStartWorkout(alt.id, false);
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      <p className="font-medium text-sm">{alt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {alt.exercise_count} exercises • Last used{" "}
                        {new Date(alt.last_used_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAlternatives(false);
                      // Log rejection without starting a specific workout
                      fetch("/api/workout/launcher", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          template_id: null,
                          accepted: false,
                          time_to_decision_ms: Date.now() - Date.now(),
                          reason: 'start_from_scratch'
                        }),
                      }).catch(err => logger.error('Failed to log launcher rejection:', err));
                      // Navigate to empty workout page
                      router.push("/workout");
                    }}
                    className="w-full rounded-lg border border-dashed border-border/60 bg-background p-3 text-left transition-colors hover:bg-secondary/30"
                  >
                    <p className="font-medium text-sm flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Start from scratch
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Build a custom workout
                    </p>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/workout/template-manager-panel.tsx
```tsx
"use client";

import { Send, Pencil, Copy, Trash2, Heart, LayoutList } from "lucide-react";
import { getMuscleColor } from "@/components/marketplace/muscle-colors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WorkoutTemplate } from "@/hooks/workout/use-template-actions";

interface TemplateManagerPanelProps {
  templates: WorkoutTemplate[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  showTemplateManager: boolean;
  templateActionBusyId: string | null;
  likedTemplateIds: Set<string>;
  onToggleManager: () => void;
  onSelectTemplate: (id: string, name: string) => void;
  onSelectStartFresh: () => void;
  onSendTemplate: (template: WorkoutTemplate) => void;
  onEditTemplate: (template: WorkoutTemplate) => void;
  onCopyTemplate: (template: WorkoutTemplate) => void;
  onDeleteTemplate: (template: WorkoutTemplate) => void;
  onToggleLike: (templateId: string) => void;
}

export function TemplateManagerPanel({
  templates,
  loadingTemplates,
  selectedTemplateId,
  showTemplateManager,
  templateActionBusyId,
  likedTemplateIds,
  onToggleManager,
  onSelectTemplate,
  onSelectStartFresh,
  onSendTemplate,
  onEditTemplate,
  onCopyTemplate,
  onDeleteTemplate,
  onToggleLike,
}: TemplateManagerPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="saved-template"
          className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
        >
          Template Selection
        </Label>
        <button
          type="button"
          onClick={onToggleManager}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutList className="size-3" />
          {showTemplateManager ? "Hide Manager" : "Template Manager"}
        </button>
      </div>
      {showTemplateManager ? (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {loadingTemplates ? (
            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
              No templates yet.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-xl border px-3 py-2 transition ${selectedTemplateId === template.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70"
                  }`}
              >
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onSendTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Send
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onEditTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onCopyTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={likedTemplateIds.has(template.id) ? "default" : "secondary"}
                    onClick={() => onToggleLike(template.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Heart className="mr-1 h-3 w-3" />
                    {likedTemplateIds.has(template.id) ? "Liked" : "Like"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSelectStartFresh}
          className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === "none"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-sm font-semibold">Start Fresh</p>
          <p className="text-xs text-muted-foreground">No template preloaded</p>
        </button>
        {loadingTemplates ? (
          <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            No templates yet. Use Template Manager above to create one here.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTemplate(template.id, template.name)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectTemplate(template.id, template.name);
              }}
              className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === template.id
                ? "border-primary/40 bg-primary/10"
                : "border-border/70 bg-card/70 hover:bg-card"
                }`}
            >
              <div className="flex items-start justify-between gap-1 mb-0.5">
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {likedTemplateIds.has(template.id) ? (
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                  ) : null}
                  {template.primary_muscle_group && template.primary_muscle_group.split(",").map((cat) => {
                    const trimmed = cat.trim();
                    const tgc = getMuscleColor(trimmed);
                    return (
                      <span
                        key={trimmed}
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                        style={{ background: tgc.bgAlpha, color: tgc.labelColor, border: `1px solid ${tgc.borderAlpha}` }}
                      >
                        {trimmed}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tap to preload</p>
              <div className="mt-1.5 flex gap-1.5">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${likedTemplateIds.has(template.id)
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    : "border-border/70 text-muted-foreground"
                    }`}
                >
                  <Heart className="h-3 w-3" />
                  Like
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---
## FILE: src/components/workout/workout-complete-celebration.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Dumbbell, TrendingUp, X, Star, Zap, Ghost, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

export interface WorkoutStats {
  duration: string; // e.g., "1h 23m"
  exerciseCount: number;
  totalVolume: number;
  unitLabel: "kg" | "lbs";
  prCount: number; // number of PRs hit
  totalSets: number;
  beatGhostCount?: number; // number of exercises where user beat their ghost
  exercises: Array<{
    name: string;
    sets: Array<{
      reps: number | null;
      weight: number | null;
      completed: boolean;
      isPR: boolean;
    }>;
  }>;
}

interface WorkoutCompleteCelebrationProps {
  stats: WorkoutStats;
  onClose: () => void;
  confettiStyle?: "gold" | "regular" | "auto";
}

export function WorkoutCompleteCelebration({
  stats,
  onClose,
  confettiStyle = "auto",
}: WorkoutCompleteCelebrationProps) {
  const [showStats, setShowStats] = useState(false);
  const recapItems = stats.exercises
    .map((exercise) => ({
      name: exercise.name,
      completedSets: exercise.sets.filter((set) => set.completed),
    }))
    .filter((exercise) => exercise.completedSets.length > 0);
  const longRecap =
    recapItems.length > 4 || recapItems.some((exercise) => exercise.completedSets.length > 5);

  const colors =
    confettiStyle === "gold" || (confettiStyle === "auto" && stats.prCount > 0)
      ? ["#FFD700", "#FFA500", "#FBBF24", "#FDE68A"]
      : ["#4D9FFF", "#FCD34D", "#F472B6", "#34D399"];

  useEffect(() => {
    // Stage 1: Radial burst immediately
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Side cannons at 400ms
    const sideCannons = setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });
    }, 400);

    // Stage 3: Show card after 300ms
    const showCard = setTimeout(() => {
      setShowStats(true);
    }, 300);

    return () => {
      clearTimeout(sideCannons);
      clearTimeout(showCard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:items-center sm:p-6">
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative my-auto w-full max-w-xl"
          >
            <Card className="relative max-h-[min(92dvh,48rem)] overflow-y-auto overflow-x-clip rounded-3xl border border-primary/35 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-2xl sm:p-6">
              {/* Animated surface tint */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Corner glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Header */}
              <div className="relative mb-6 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 18,
                  }}
                  className="mb-3 flex justify-center"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-2xl">
                    <Zap className="h-9 w-9 text-primary-foreground" />
                    {[0, 120, 240].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-full w-full"
                        animate={{ rotate: [deg, deg + 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                      >
                        <Star className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-primary" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs font-bold uppercase tracking-[0.22em] text-primary"
                >
                  Workout Complete
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="mt-1 text-3xl font-black tracking-tight"
                >
                  Session Locked In
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.46 }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Great work today. Here&apos;s your recap.
                </motion.p>
              </div>

              {/* Stats Grid */}
              <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Duration</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">{stats.duration}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Volume</span>
                  </div>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">
                    {stats.totalVolume.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground sm:text-sm">{stats.unitLabel}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Dumbbell className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Exercises</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.exerciseCount}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="min-w-0 rounded-xl border border-border/70 bg-secondary/45 p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wider">Sets</span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{stats.totalSets}</p>
                </motion.div>
              </div>

              {/* Workout Recap */}
              <div className="relative mt-6 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workout Recap
                </h3>
                <div
                  className={cn(
                    "space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/40 p-3",
                    longRecap ? "max-h-[min(26dvh,210px)]" : "max-h-[min(32dvh,260px)]"
                  )}
                >
                  {recapItems.map((exercise, exerciseIndex) => (
                    <motion.div
                      key={exercise.name + exerciseIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + exerciseIndex * 0.05 }}
                      className="space-y-1.5"
                    >
                      <p className="truncate text-sm font-semibold">{exercise.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.completedSets.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            className={cn(
                              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition-all",
                              set.isPR
                                ? "border-primary/40 bg-gradient-to-r from-primary/20 to-accent/20 text-primary"
                                : "border-border/70 bg-card/50 text-foreground"
                            )}
                          >
                            {set.weight != null && set.reps != null ? (
                              <>
                                {set.weight}{stats.unitLabel} × {set.reps}
                                {set.isPR && <Trophy className="inline h-3 w-3 ml-1" />}
                              </>
                            ) : set.reps != null ? (
                              `${set.reps} reps`
                            ) : (
                              "Set completed"
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* PR Badge */}
              {stats.prCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-6 rounded-xl border border-primary/35 bg-gradient-to-r from-primary/20 to-accent/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold text-primary">
                      {stats.prCount} Personal Record{stats.prCount > 1 ? "s" : ""}!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re getting stronger! <Trophy className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Ghost Comparison Badge */}
              {stats.beatGhostCount != null && stats.beatGhostCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.0, type: "spring", stiffness: 300, damping: 20 }}
                  className="mt-4 rounded-xl border border-accent/45 bg-gradient-to-r from-accent/20 to-primary/20 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Ghost className="h-5 w-5 text-foreground" />
                    <span className="text-lg font-bold text-foreground">
                      Beat Your Past Self on {stats.beatGhostCount}/{stats.exerciseCount} Exercises!
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center justify-center gap-1">You&apos;re making progress! <Flame className="inline h-3 w-3" /></p>
                </motion.div>
              )}

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="relative mt-6"
              >
                <Button
                  onClick={onClose}
                  className="motion-press w-full rounded-xl"
                  size="lg"
                >
                  Continue Training
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---
## FILE: src/components/workout/workout-completion-dialog.tsx
```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export interface WorkoutCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionRpeValue: number;
  onSessionRpeChange: (value: number) => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * Post-workout session RPE prompt dialog.
 * Shown after the workout celebration and optional level-up modal close.
 */
export function WorkoutCompletionDialog({
  open,
  onOpenChange,
  sessionRpeValue,
  onSessionRpeChange,
  onSave,
  saving,
}: WorkoutCompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Session Effort</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quick post-session rating. This improves your fatigue estimate.
          </p>
          <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">What is sRPE?</p>
            <p className="mt-1">
              sRPE means <span className="font-semibold">Session Rate of Perceived Exertion</span>:
              how hard the <span className="font-semibold">entire workout</span> felt on a 0-10
              scale.
            </p>
            <p className="mt-1">
              0-2 = very easy, 3-5 = moderate, 6-8 = hard, 9-10 = near max effort.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Session RPE</span>
              <span className="font-semibold tabular-nums">{sessionRpeValue.toFixed(1)}</span>
            </div>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={[sessionRpeValue]}
              onValueChange={(value) => onSessionRpeChange(value[0] ?? 7)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Very easy</span>
              <span>Max effort</span>
            </div>
          </div>
          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Effort"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/workout/workout-header.tsx
```tsx
"use client";

import { memo, useEffect, useState } from "react";
import { Activity, CircleCheck, Clock3, Dumbbell, Layers, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ElapsedTime -- memo-isolated so its 1-second tick does NOT cause the parent
 * WorkoutPage to re-render. startedAt is a stable string for the lifetime of
 * a session, so memo's shallow prop comparison will always bail out.
 */
export const ElapsedTime = memo(function ElapsedTime({
  startedAt,
  className,
}: {
  startedAt: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return <span className={className}>{`${pad(hrs)}:${pad(mins)}:${pad(secs)}`}</span>;
});

export interface WorkoutHeaderProps {
  workoutName: string;
  startedAt: string;
  totalVolumeDisplay: string;
  completedSets: number;
  totalSets: number;
  exerciseCount: number;
  completionProgressPct: number;
  unitLabel: string;
}

/**
 * Active session hero banner with glows, stats badges, and progress bar.
 * Timer is isolated via memo (ElapsedTime) so ticks don't propagate.
 */
export function WorkoutHeader({
  workoutName,
  startedAt,
  totalVolumeDisplay,
  completedSets,
  totalSets,
  exerciseCount,
  completionProgressPct,
  unitLabel,
}: WorkoutHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active Session</p>
            <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">
              {workoutName}
            </h2>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Clock3 className="size-4" />
            <ElapsedTime startedAt={startedAt} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
            <Activity className="mr-1 h-3.5 w-3.5" />
            {totalVolumeDisplay} {unitLabel}
          </Badge>
          <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            <CircleCheck className="mr-1 h-3.5 w-3.5" />
            {completedSets} done
          </Badge>
          <Badge className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-300">
            <Layers className="mr-1 h-3.5 w-3.5" />
            {totalSets} total sets
          </Badge>
          <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-300">
            <Dumbbell className="mr-1 h-3.5 w-3.5" />
            {exerciseCount} exercises
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Session Progress</span>
            <span>{completionProgressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${completionProgressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

---
## FILE: src/components/history/history-nav.tsx
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { CalendarDays, TrendingUp, Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/history", label: "Calendar", icon: CalendarDays },
  { href: "/history/progress", label: "Progress", icon: TrendingUp },
  { href: "/history/prs", label: "PRs", icon: Trophy },
  { href: "/history/stats", label: "Stats", icon: BarChart3 },
] as const;

export function HistoryNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/history") return pathname === "/history";
    return pathname.startsWith(href);
  }

  return (
    <LayoutGroup id="history-nav">
      <nav
        aria-label="History sections"
        className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none rounded-2xl border border-border/60 bg-card/40 p-1.5"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="block shrink-0 select-none"
            >
              <motion.span
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative flex h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-3.5 sm:text-[12px]",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="history-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-primary/75 shadow-[0_2px_12px_hsl(var(--primary)/0.35)]"
                  />
                )}
                <Icon className={cn("relative z-[1] size-4", active ? "text-background" : "")} />
                <span className="relative z-[1]">{label}</span>
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
```

---
## FILE: src/components/history/workout-heatmap.tsx
```tsx
"use client";

import { useMemo } from "react";
import { format, subDays, startOfDay, getDay } from "date-fns";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkoutDay = {
  date: string; // yyyy-MM-dd
  count: number;
};

interface WorkoutHeatmapProps {
  /** Map of "yyyy-MM-dd" → number of sessions */
  sessionsByDay: Map<string, unknown[]>;
  /** Total weeks to show (default 26 = 6 months) */
  weeks?: number;
}

// ─── Month labels ─────────────────────────────────────────────────────────────

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkoutHeatmap({ sessionsByDay, weeks = 26 }: WorkoutHeatmapProps) {
  const days = useMemo<WorkoutDay[]>(() => {
    const today = startOfDay(new Date());
    const totalDays = weeks * 7;
    const result: WorkoutDay[] = [];

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      result.push({ date: key, count: (sessionsByDay.get(key) ?? []).length });
    }
    return result;
  }, [sessionsByDay, weeks]);

  // Pad so the first day of the grid aligns to Monday (day 1)
  const firstDay = days[0] ? new Date(`${days[0].date}T12:00:00`) : new Date();
  const startPad = (getDay(firstDay) + 6) % 7; // Mon=0

  const paddedDays: (WorkoutDay | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...days,
  ];

  // Find month boundaries for labels
  const monthLabels: { col: number; label: string }[] = [];
  let prevMonth = "";
  paddedDays.forEach((d, i) => {
    if (!d) return;
    const col = Math.floor(i / 7);
    const month = d.date.slice(5, 7);
    if (month !== prevMonth) {
      prevMonth = month;
      monthLabels.push({ col, label: format(new Date(`${d.date}T12:00:00`), "MMM") });
    }
  });

  const totalCols = Math.ceil(paddedDays.length / 7);

  function cellColor(count: number) {
    if (count === 0) return "bg-muted/40";
    if (count === 1) return "bg-primary/40";
    if (count === 2) return "bg-primary/65";
    return "bg-primary shadow-[0_0_6px_var(--phase-current-glow,oklch(0.78_0.16_195_/_0.20))]";
  }

  const totalSessions = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div className="glass-surface glass-highlight rounded-2xl p-5">
      {/* Premium header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <p className="text-[13px] font-bold text-foreground">Activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {totalSessions} sessions
          </span>
          <span className="text-[11px] text-muted-foreground">
            {activeDays} active days
          </span>
        </div>
      </div>

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: totalCols * 16 + 28 }}>
          {/* Month labels */}
          <div className="relative mb-0.5 ml-7 h-4">
            {monthLabels.map(({ col, label }) => (
              <span
                key={`${col}-${label}`}
                className="absolute text-[10px] font-medium text-muted-foreground"
                style={{ left: col * 16 }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Grid: day labels + cells */}
          <div className="flex gap-[2px]">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[2px] pr-1">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-3.5 items-center text-[10px] font-semibold text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Columns (weeks) */}
            {Array.from({ length: totalCols }).map((_, col) => (
              <div key={col} className="flex flex-col gap-[2px]">
                {Array.from({ length: 7 }).map((_, row) => {
                  const item = paddedDays[col * 7 + row];
                  if (!item) {
                    return <div key={row} className="h-3.5 w-3.5" />;
                  }
                  return (
                    <div
                      key={row}
                      title={`${item.date}: ${item.count} session${item.count !== 1 ? "s" : ""}`}
                      className={cn(
                        "h-3.5 w-3.5 rounded-[2px] transition-opacity hover:opacity-80",
                        cellColor(item.count)
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Less</span>
            {[0, 1, 2, 3].map((level) => (
              <div
                key={level}
                className={cn(
                  "h-3.5 w-3.5 rounded-[2px]",
                  level === 0
                    ? "bg-muted/40"
                    : level === 1
                    ? "bg-primary/40"
                    : level === 2
                    ? "bg-primary/65"
                    : "bg-primary"
                )}
              />
            ))}
            <span className="text-[10px] font-medium text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---
## FILE: src/components/social/mini-dashboard-card.tsx
```tsx
"use client";


import Link from "next/link";
import Image from "next/image";
import { Flame, Dumbbell, Copy, Heart, Play, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/clip-categories";
import { ProfileWorkoutCalendar } from "./profile-workout-calendar";

export interface ProfileClip {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  clip_category: string | null;
  like_count: number;
}

export interface MiniTemplate {
  id: string;
  name: string;
  exercise_count: number;
  save_count: number;
  isFavorited?: boolean;
}

export interface MiniDashboardProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  current_streak: number;
  is_public: boolean;
}

interface MiniDashboardCardProps {
  profile: MiniDashboardProfile;
  clips: ProfileClip[];
  templates: MiniTemplate[];
  favoritedTemplates: MiniTemplate[];
  activeWorkout?: { session_name: string; started_at: string; exercise_count: number } | null;
  workoutDays?: Date[];
  isFollowing: boolean;
  isSelf: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onPing: () => void;
  onCopyTemplate: (template: MiniTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  improve_endurance: "Improve Endurance",
  stay_active: "Stay Active",
  sport_performance: "Sport Performance",
};

function ClipThumb({ clip }: { clip: ProfileClip }) {
  return (
    <Link
      href="/sets"
      className="relative shrink-0 w-[110px] h-[185px] rounded-xl overflow-hidden bg-black block"
      aria-label="View Sets"
    >
      {clip.thumbnail_url ? (
        <Image
          src={clip.thumbnail_url}
          alt=""
          fill
          sizes="110px"
          unoptimized
          className="w-full h-full object-cover"
        />
      ) : (
        <video
          src={clip.video_url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )}
      {clip.clip_category && (
        <span className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white leading-tight">
          {CATEGORY_LABELS[clip.clip_category] ?? clip.clip_category}
        </span>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-black/50 p-2.5">
          <Play className="size-4 text-white fill-white" />
        </div>
      </div>
      <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1">
        <Heart className="size-3 text-white fill-white" />
        <span className="text-[10px] text-white font-medium">{clip.like_count}</span>
      </div>
    </Link>
  );
}

export function MiniDashboardCard({
  profile,
  clips,
  templates,
  favoritedTemplates,
  activeWorkout,
  workoutDays,
  isFollowing,
  isSelf,
  onFollow,
  onUnfollow,
  onPing,
  onCopyTemplate,
  onToggleFavorite,
}: MiniDashboardCardProps) {
  const displayName = profile.display_name ?? profile.username ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const goalLabel = profile.fitness_goal
    ? (GOAL_LABELS[profile.fitness_goal] ?? profile.fitness_goal)
    : null;

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-14 shrink-0">
              <AvatarFallback className="text-base font-semibold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base leading-tight truncate">
                {displayName}
              </h2>
              {profile.username && (
                <p className="text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-foreground/80 mt-1 leading-snug line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {activeWorkout && (
              <div className="flex items-center gap-1.5 bg-green-500/10 rounded-full px-3 py-1 animate-pulse">
                <Activity className="size-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-500">
                  Working out now <Dumbbell className="inline size-3.5 ml-0.5" />
                </span>
              </div>
            )}
            {profile.current_streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 rounded-full px-3 py-1">
                <Flame className="size-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500">
                  {profile.current_streak}-day streak
                </span>
              </div>
            )}
            {goalLabel && (
              <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                <Dumbbell className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {goalLabel}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isSelf && (
            <div className="flex gap-2">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="flex-1"
                onClick={isFollowing ? onUnfollow : onFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onPing}
              >
                Ping <Dumbbell className="inline size-3.5 ml-0.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout calendar */}
      {workoutDays && workoutDays.length > 0 && (
        <ProfileWorkoutCalendar workoutDays={workoutDays} />
      )}

      {/* Sets clips strip */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground px-1">Sets</p>
        {clips.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No Sets posted yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {clips.map((clip) => (
              <ClipThumb key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </div>

      {/* Shared templates */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground px-1">
            Shared Templates
          </p>
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{tpl.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {tpl.exercise_count} exercises
                      </span>
                      {tpl.save_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0"
                        >
                          {tpl.save_count}{" "}
                          {tpl.save_count === 1 ? "athlete" : "athletes"} running
                          this
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSelf && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onToggleFavorite(tpl.id)}
                          aria-label={
                            tpl.isFavorited
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <Heart
                            className={`size-4 ${tpl.isFavorited ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onCopyTemplate(tpl)}
                          aria-label="Copy template"
                        >
                          <Copy className="size-4 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No shared templates yet.
        </p>
      )}

      {/* Favorited templates */}
      {favoritedTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground px-1">
            Favorited Templates
          </p>
          {favoritedTemplates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Heart className="size-4 text-rose-500 fill-rose-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{tpl.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {tpl.exercise_count} exercises
                    </span>
                  </div>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => onCopyTemplate(tpl)}
                      aria-label="Copy template"
                    >
                      <Copy className="size-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/components/social/ping-inbox.tsx
```tsx
"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import type { Ping } from "@/hooks/use-pings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PingInboxProps {
  pings: Ping[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  onDeletePing: (pingId: string) => Promise<void>;
}

export function PingInbox({
  pings,
  unreadCount,
  onMarkAllRead,
  onClearRead,
  onDeletePing,
}: PingInboxProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const readCount = pings.length - unreadCount;

  async function handleDelete(pingId: string) {
    setDeleting(pingId);
    try {
      await onDeletePing(pingId);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card className="border-border/70 bg-card/85">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <CardTitle className="text-base">Ping Inbox</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            {readCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearRead}>
                Clear read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pings yet
          </p>
        ) : (
          <ul className="space-y-2">
            {pings.map((ping) => (
              <li
                key={ping.id}
                className={`rounded-xl border p-3 text-sm ${
                  !ping.read_at
                    ? "border-primary/30 bg-primary/10"
                    : "border-border/60 bg-background/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="font-medium">
                          {ping.sender?.display_name ||
                            ping.sender?.username ||
                            "Someone"}
                        </span>
                        <span className="text-muted-foreground"> sent: </span>
                        <span>{ping.message}</span>
                      </div>
                      {!ping.read_at && (
                        <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/90">
                      {formatDistanceToNow(new Date(ping.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDelete(ping.id)}
                    disabled={deleting === ping.id}
                    aria-label="Delete ping"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/social/presence-dot.tsx
```tsx
"use client";

import { useIsOnline } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";

interface PresenceDotProps {
  userId: string;
  size?: "sm" | "md";
  className?: string;
}

export function PresenceDot({ userId, size = "sm", className }: PresenceDotProps) {
  const online = useIsOnline(userId);

  return (
    <span
      className={cn(
        "rounded-full border-2 border-background",
        size === "sm" ? "size-2.5" : "size-3.5",
        online ? "bg-green-500" : "bg-muted-foreground/40",
        className
      )}
      title={online ? "Online" : "Offline"}
    />
  );
}
```

---
## FILE: src/components/social/profile-tab-content.tsx
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Settings, Flame, Lock, Globe, Target, Trophy } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { SetsPreviewCard } from "@/components/social/sets-preview-card";

interface ProfileData {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  is_public: boolean;
  current_streak: number;
}

interface ActivityStats {
  setsPosted: number;
  templatesShared: number;
  podsJoined: number;
}

interface ClipPreview {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  clip_category: string | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
}

export function ProfileTabContent() {
  const router = useRouter();
  const supabase = useSupabase();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<ActivityStats>({ setsPosted: 0, templatesShared: 0, podsJoined: 0 });
  const [clips, setClips] = useState<ClipPreview[]>([]);
  const [pinnedClips, setPinnedClips] = useState<ClipPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile data
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, fitness_goal, is_public, current_streak")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          id: data.id,
          email: user.email ?? "",
          display_name: data.display_name,
          username: data.username,
          bio: data.bio,
          fitness_goal: data.fitness_goal,
          is_public: data.is_public,
          current_streak: data.current_streak ?? 0,
        });

        // Fetch activity stats in parallel
        const [clipsCount, templatesCount, podsCount, clipsResult] = await Promise.all([
          // Sets posted
          supabase
            .from("workout_clips")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),

          // Templates shared
          supabase
            .from("workout_templates")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_shared", true),

          // Pods joined
          supabase
            .from("pod_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active"),

          // Sets preview
          supabase
            .from("workout_clips")
            .select("id, video_url, thumbnail_url, caption, clip_category, like_count, comment_count, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(18),
        ]);

        setStats({
          setsPosted: clipsCount.count ?? 0,
          templatesShared: templatesCount.count ?? 0,
          podsJoined: podsCount.count ?? 0,
        });
        const loadedClips = (clipsResult.data ?? []) as ClipPreview[];
        setClips(loadedClips);
        setPinnedClips(
          [...loadedClips]
            .sort(
              (a, b) =>
                ((b.like_count ?? 0) * 1.4 + (b.comment_count ?? 0) * 2.2) -
                ((a.like_count ?? 0) * 1.4 + (a.comment_count ?? 0) * 2.2)
            )
            .slice(0, 3)
        );
      }
      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "User";
  const goalLabel = profile.fitness_goal
    ? profile.fitness_goal.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
    : null;

  return (
    <div className="space-y-4 mt-4">
      {/* Profile Card */}
      <Card className="relative overflow-hidden border-border/70 bg-card/85">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Profile</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/settings")}
            >
              <Edit className="size-4 mr-1.5" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {displayName[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
                <p className="text-lg font-semibold">{displayName}</p>
                {profile.username && (
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                )}
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            {profile.current_streak > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Flame className="mr-1 size-3 text-orange-400" />
                {profile.current_streak} day streak
              </Badge>
            )}
            {goalLabel && (
              <Badge variant="secondary" className="text-xs">
                <Target className="mr-1 size-3 text-primary" />
                {goalLabel}
              </Badge>
            )}
            <Badge variant={profile.is_public ? "default" : "outline"} className="text-xs">
              {profile.is_public ? (
                <>
                  <Globe className="mr-1 size-3" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="mr-1 size-3" />
                  Private
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings CTA */}
      <Card className="border-2 border-dashed border-border/70">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Manage Your Profile</p>
              <p className="text-xs text-muted-foreground">
                Update your display name, bio, fitness goals, and privacy settings
              </p>
            </div>
            <Button size="sm" onClick={() => router.push("/settings")}>
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={<Trophy className="h-4 w-4 text-primary" />}
          value={stats.setsPosted}
          label="Sets Posted"
          className="border-border/70 bg-card/80"
        />
        <StatCard
          icon={<Edit className="h-4 w-4 text-primary" />}
          value={stats.templatesShared}
          label="Shared"
          className="border-border/70 bg-card/80"
        />
        <StatCard
          icon={<Settings className="h-4 w-4 text-primary" />}
          value={stats.podsJoined}
          label="Pods"
          className="border-border/70 bg-card/80"
        />
      </div>

      <SetsPreviewCard clips={clips} pinnedClips={pinnedClips} currentUserId={profile.id} />
    </div>
  );
}
```

---
## FILE: src/components/social/profile-workout-calendar.tsx
```tsx
"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface Props {
  workoutDays: Date[];
}

export function ProfileWorkoutCalendar({ workoutDays }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Workout Calendar</h3>
      <DayPicker
        disabled={{ after: new Date() }}
        modifiers={{ workedOut: workoutDays }}
        modifiersClassNames={{
          workedOut: "bg-primary/20 rounded-md font-semibold"
        }}
        className="text-sm"
      />
      <p className="text-xs text-muted-foreground mt-2">
        {workoutDays.length} workouts in the last 90 days
      </p>
    </div>
  );
}
```

---
## FILE: src/components/social/send-meal-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle2, Loader2 } from "lucide-react";
import type { MealDaySnapshot } from "@/hooks/use-shared-items";

interface Recipient {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface SendMealDialogProps {
  open: boolean;
  currentUserId: string | null;
  snapshot: MealDaySnapshot | null;
  onClose: () => void;
  onSend: (recipientId: string, snapshot: MealDaySnapshot, message?: string) => Promise<void>;
}

export function SendMealDialog({
  open,
  currentUserId,
  snapshot,
  onClose,
  onSend,
}: SendMealDialogProps) {
  const supabase = useSupabase();
  const [following, setFollowing] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    if (!open || !currentUserId) return;
    setSelectedId(null);
    setMessage("");

    setLoadingFollowing(true);
    supabase
      .from("user_follows")
      .select(`following_id, profiles!user_follows_following_id_fkey(id, display_name, username)`)
      .eq("follower_id", currentUserId)
      .then(({ data }) => {
        if (data) {
          setFollowing(
            data
              .map((f) => f.profiles as unknown as Recipient | null)
              .filter(Boolean) as Recipient[]
          );
        }
        setLoadingFollowing(false);
      });
  }, [open, currentUserId, supabase]);

  async function handleSend() {
    if (!selectedId || !snapshot) return;
    setSending(true);
    try {
      await onSend(selectedId, snapshot, message.trim() || undefined);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Today&apos;s Meals</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Macro preview */}
          {snapshot && (
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 p-3 text-center text-xs">
              <div>
                <p className="font-semibold">{Math.round(snapshot.totals.calories)}</p>
                <p className="text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="font-semibold text-blue-400">{Math.round(snapshot.totals.protein_g)}g</p>
                <p className="text-muted-foreground">protein</p>
              </div>
              <div>
                <p className="font-semibold text-yellow-400">{Math.round(snapshot.totals.carbs_g)}g</p>
                <p className="text-muted-foreground">carbs</p>
              </div>
              <div>
                <p className="font-semibold text-pink-400">{Math.round(snapshot.totals.fat_g)}g</p>
                <p className="text-muted-foreground">fat</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-400">{Math.round(snapshot.totals.fiber_g)}g</p>
                <p className="text-muted-foreground">fiber</p>
              </div>
              <div>
                <p className="font-semibold text-rose-400">{Math.round(snapshot.totals.sugar_g ?? 0)}g</p>
                <p className="text-muted-foreground">sugar</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-400">{Math.round(snapshot.totals.sodium_mg ?? 0)}mg</p>
                <p className="text-muted-foreground">sodium</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Send to</Label>
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : following.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Follow users from the Social tab to share with them.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {following.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                      selectedId === user.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-accent"
                    }`}
                  >
                    <UserCircle2 className="size-5 text-muted-foreground shrink-0" />
                    <span>{user.display_name || user.username || "Anonymous"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-msg">Message (optional)</Label>
            <Input
              id="meal-msg"
              placeholder="e.g. Meal prep from Sunday!"
              maxLength={100}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedId || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/social/send-ping-dialog.tsx
```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_MESSAGES = [
  "Keep it up!",
  "Great work!",
  "Crushing it!",
  "Amazing effort!",
];

interface SendPingDialogProps {
  open: boolean;
  recipientName: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export function SendPingDialog({
  open,
  recipientName,
  onClose,
  onSend,
}: SendPingDialogProps) {
  const [selected, setSelected] = useState(PRESET_MESSAGES[0]);
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);

  const message = custom.trim() || selected;

  async function handleSend() {
    setSending(true);
    try {
      await onSend(message);
      setCustom("");
      setSelected(PRESET_MESSAGES[0]);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Ping to {recipientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESET_MESSAGES.map((msg) => (
              <button
                key={msg}
                type="button"
                onClick={() => { setSelected(msg); setCustom(""); }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  selected === msg && !custom.trim()
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {msg}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-ping">Custom message (optional)</Label>
            <Input
              id="custom-ping"
              placeholder="Write something encouraging…"
              maxLength={100}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">
              {custom.length}/100
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send Ping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/social/send-template-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle2, Loader2 } from "lucide-react";
import type { TemplateSnapshot } from "@/hooks/use-shared-items";

interface Recipient {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface SendTemplateDialogProps {
  open: boolean;
  currentUserId: string | null;
  template: {
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null;
  onClose: () => void;
  onSend: (recipientId: string, template: SendTemplateDialogProps["template"] & object, message?: string) => Promise<void>;
}

export function SendTemplateDialog({
  open,
  currentUserId,
  template,
  onClose,
  onSend,
}: SendTemplateDialogProps) {
  const supabase = useSupabase();
  const [following, setFollowing] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    if (!open || !currentUserId) return;
    setSelectedId(null);
    setMessage("");

    setLoadingFollowing(true);
    supabase
      .from("user_follows")
      .select(`following_id, profiles!user_follows_following_id_fkey(id, display_name, username)`)
      .eq("follower_id", currentUserId)
      .then(({ data }) => {
        if (data) {
          setFollowing(
            data
              .map((f) => f.profiles as unknown as Recipient | null)
              .filter(Boolean) as Recipient[]
          );
        }
        setLoadingFollowing(false);
      });
  }, [open, currentUserId, supabase]);

  async function handleSend() {
    if (!selectedId || !template) return;
    setSending(true);
    try {
      await onSend(selectedId, template, message.trim() || undefined);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send &ldquo;{template?.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : following.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re not following anyone yet. Follow users from the Social tab first.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {following.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                      selectedId === user.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-accent"
                    }`}
                  >
                    <UserCircle2 className="size-5 text-muted-foreground shrink-0" />
                    <span>{user.display_name || user.username || "Anonymous"}</span>
                    {user.username && (
                      <span className="text-muted-foreground text-xs">@{user.username}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="send-msg">Message (optional)</Label>
            <Input
              id="send-msg"
              placeholder="Give them some context…"
              maxLength={100}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedId || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## FILE: src/components/social/sets-preview-card.tsx
```tsx
"use client";

import Link from "next/link";
import { Video, MessageCircle, Heart, Plus, ArrowUpRight, Pin, Play } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/clip-categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/hooks/use-supabase";
import { trackProfileSetOpened } from "@/lib/retention-events";

interface ClipPreview {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  clip_category: string | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
}

interface SetsPreviewCardProps {
  clips: ClipPreview[];
  pinnedClips?: ClipPreview[];
  currentUserId?: string | null;
}

export function SetsPreviewCard({
  clips,
  pinnedClips = [],
  currentUserId = null,
}: SetsPreviewCardProps) {
  const supabase = useSupabase();

  function trackOpen(clipId: string, location: "pinned" | "grid") {
    if (!currentUserId) return;
    void trackProfileSetOpened(supabase, currentUserId, { clip_id: clipId, location });
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-primary" />
              Your Sets Preview
            </CardTitle>
            <CardDescription className="text-xs">
              TikTok-style mini previews of your posted workout clips
            </CardDescription>
          </div>
          <Link href="/sets/upload">
            <Button size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Post
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {clips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-5 text-center">
            <p className="text-sm text-muted-foreground">No sets posted yet.</p>
            <Link href="/sets/upload">
              <Button variant="outline" size="sm" className="mt-3">
                Upload Your First Set
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pinnedClips.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Pin className="h-3 w-3" />
                  Pinned Top Sets
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {pinnedClips.slice(0, 3).map((clip, idx) => (
                    <Link
                      key={`pin-${clip.id}`}
                      href="/sets"
                      onClick={() => trackOpen(clip.id, "pinned")}
                      className="group relative overflow-hidden rounded-xl border border-primary/30 bg-black"
                      style={{ aspectRatio: "9 / 16" }}
                    >
                      {clip.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.caption ?? `Pinned clip ${idx + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={clip.video_url}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                        #{idx + 1}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-white/90">
                          <Heart className="h-3 w-3" />
                          <span>{clip.like_count ?? 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                All Sets
              </p>
              <div className="grid grid-cols-3 gap-2">
                {clips.map((clip) => (
                  <Link
                    key={clip.id}
                    href="/sets"
                    onClick={() => trackOpen(clip.id, "grid")}
                    className="group relative overflow-hidden rounded-xl border border-border/70 bg-black"
                    style={{ aspectRatio: "9 / 16" }}
                  >
                    {clip.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clip.thumbnail_url}
                        alt={clip.caption ?? "Workout clip"}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={clip.video_url}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-1.5">
                      <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        <Play className="h-2.5 w-2.5" />
                        {clip.clip_category ? CATEGORY_LABELS[clip.clip_category] ?? "Set" : "Set"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/85">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {clip.like_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {clip.comment_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <Link href="/sets">
          <Button variant="outline" className="w-full justify-between">
            Open Sets Feed
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/social/shared-item-card.tsx
```tsx
"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Dumbbell, Salad, BookCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { useRouter } from "next/navigation";
import type { SharedItem, TemplateSnapshot, MealDaySnapshot } from "@/hooks/use-shared-items";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SharedItemCardProps {
  item: SharedItem;
  currentUserId: string;
  onClearInboxItem: (itemId: string) => Promise<void>;
}

export function SharedItemCard({
  item,
  currentUserId,
  onClearInboxItem,
}: SharedItemCardProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const senderName =
    item.sender?.display_name || item.sender?.username || "Someone";
  const isUnread = !item.read_at;

  async function handleSaveTemplate() {
    const snapshot = item.item_snapshot as TemplateSnapshot;
    setSaving(true);
    try {
      let templateName = snapshot.name;
      let templateDescription = snapshot.description;
      let normalizedExercises: Array<{
        exercise_id: string;
        sort_order: number;
        sets: Array<{
          set_number: number;
          reps: number | null;
          weight_kg: number | null;
          set_type: string | null;
          rest_seconds: number | null;
        }>;
      }> = [];

      // Prefer cloning from canonical template data when available.
      if (item.template_id) {
        const { data: source } = await supabase
          .from("workout_templates")
          .select(
            "name, description, template_exercises(exercise_id, sort_order, template_exercise_sets(set_number, reps, weight_kg, set_type, rest_seconds))"
          )
          .eq("id", item.template_id)
          .maybeSingle();

        if (source) {
          templateName = source.name;
          templateDescription = source.description;
          const sourceExercises = Array.isArray(source.template_exercises)
            ? source.template_exercises
            : [];
          normalizedExercises = sourceExercises
            .filter((ex) => !!ex.exercise_id)
            .map((ex) => {
              const sets = Array.isArray(ex.template_exercise_sets)
                ? ex.template_exercise_sets
                : [];
              return {
                exercise_id: ex.exercise_id,
                sort_order: ex.sort_order,
                sets: sets.map((s) => ({
                  set_number: s.set_number,
                  reps: s.reps,
                  weight_kg: s.weight_kg,
                  set_type: s.set_type ?? null,
                  rest_seconds: s.rest_seconds ?? null,
                })),
              };
            });
        }
      }

      // Fallback to snapshot (for legacy shares / deleted source templates).
      if (normalizedExercises.length === 0) {
        for (let i = 0; i < snapshot.exercises.length; i++) {
          const ex = snapshot.exercises[i];
          let exerciseId = ex.exercise_id ?? null;

          if (!exerciseId) {
            const { data: exData } = await supabase
              .from("exercises")
              .select("id")
              .ilike("name", ex.name)
              .limit(1)
              .maybeSingle();
            exerciseId = exData?.id ?? null;
          }

          if (!exerciseId) continue;

          normalizedExercises.push({
            exercise_id: exerciseId,
            sort_order: i + 1,
            sets: ex.sets.map((s, idx) => ({
              set_number: idx + 1,
              reps: s.reps,
              weight_kg: s.weight_kg,
              set_type: "working",
              rest_seconds: null,
            })),
          });
        }
      }

      if (normalizedExercises.length === 0) {
        throw new Error("No exercises available to save");
      }

      // Create new template
      const { data: newTpl, error: tplErr } = await supabase
        .from("workout_templates")
        .insert({
          user_id: currentUserId,
          name: templateName,
          description: templateDescription,
          is_shared: false,
        })
        .select("id")
        .single();

      if (tplErr || !newTpl) throw tplErr ?? new Error("Failed to create");

      // Clone exercises and sets.
      for (const ex of normalizedExercises) {
        const { data: newEx } = await supabase
          .from("template_exercises")
          .insert({
            template_id: newTpl.id,
            exercise_id: ex.exercise_id,
            sort_order: ex.sort_order,
          })
          .select("id")
          .single();

        if (!newEx) continue;

        if (ex.sets.length > 0) {
          await supabase.from("template_exercise_sets").insert(
            ex.sets.map((s) => ({
              template_exercise_id: newEx.id,
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
              set_type: s.set_type ?? "working",
              rest_seconds: s.rest_seconds,
            }))
          );
        }
      }

      toast.success("Template saved to your library!");
      router.push("/templates");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearInbox() {
    setClearing(true);
    try {
      await onClearInboxItem(item.id);
      toast.success("Removed from inbox");
    } catch {
      toast.error("Failed to clear item");
    } finally {
      setClearing(false);
    }
  }

  if (item.item_type === "template") {
    const snapshot = item.item_snapshot as TemplateSnapshot;
    return (
      <Card className={isUnread ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/80"}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{senderName} sent you a workout</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {isUnread && <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1 rounded-lg border border-border/60 bg-background/40 p-3">
            <p className="text-sm font-semibold">{snapshot.name}</p>
            {snapshot.description && (
              <p className="text-xs text-muted-foreground">{snapshot.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {snapshot.exercises.slice(0, 4).map((ex, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {ex.name}
                </Badge>
              ))}
              {snapshot.exercises.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{snapshot.exercises.length - 4} more
                </Badge>
              )}
            </div>
          </div>
          {item.message && (
            <p className="text-xs text-muted-foreground italic">&quot;{item.message}&quot;</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={saving || clearing}
              onClick={handleSaveTemplate}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <BookCopy className="size-3.5" />
              )}
              Save Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={saving || clearing}
              onClick={handleClearInbox}
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Clear Inbox"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // meal_day
  const snapshot = item.item_snapshot as MealDaySnapshot;
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

  return (
    <Card className={isUnread ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/80"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Salad className="size-4 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">{senderName} shared their meals</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.date} ·{" "}
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {isUnread && <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Macro totals */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/40 p-2 text-center text-xs">
          <div>
            <p className="font-semibold">{Math.round(snapshot.totals.calories)}</p>
            <p className="text-muted-foreground">kcal</p>
          </div>
          <div>
            <p className="font-semibold text-blue-400">{Math.round(snapshot.totals.protein_g)}g</p>
            <p className="text-muted-foreground">protein</p>
          </div>
          <div>
            <p className="font-semibold text-yellow-400">{Math.round(snapshot.totals.carbs_g)}g</p>
            <p className="text-muted-foreground">carbs</p>
          </div>
          <div>
            <p className="font-semibold text-pink-400">{Math.round(snapshot.totals.fat_g)}g</p>
            <p className="text-muted-foreground">fat</p>
          </div>
          <div>
            <p className="font-semibold text-emerald-400">{Math.round(snapshot.totals.fiber_g)}g</p>
            <p className="text-muted-foreground">fiber</p>
          </div>
          <div>
            <p className="font-semibold text-rose-400">{Math.round(snapshot.totals.sugar_g ?? 0)}g</p>
            <p className="text-muted-foreground">sugar</p>
          </div>
          <div>
            <p className="font-semibold text-cyan-400">{Math.round(snapshot.totals.sodium_mg ?? 0)}mg</p>
            <p className="text-muted-foreground">sodium</p>
          </div>
        </div>

        {/* Meals breakdown */}
        {mealTypes.map((meal) => {
          const entries = snapshot.meals[meal];
          if (!entries || entries.length === 0) return null;
          return (
            <div key={meal}>
              <p className="text-xs font-medium capitalize text-muted-foreground mb-1">{meal}</p>
              <div className="space-y-0.5">
                {entries.map((entry, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate">{entry.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {Math.round(entry.calories)} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {item.message && (
          <p className="text-xs text-muted-foreground italic">&quot;{item.message}&quot;</p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={clearing}
          onClick={handleClearInbox}
        >
          {clearing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Clear Inbox"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---
## FILE: src/components/social/user-card.tsx
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2, Zap, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { PresenceDot } from "./presence-dot";
import { SendPingDialog } from "./send-ping-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface UserCardUser {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  isFollowing?: boolean;
}

interface UserCardProps {
  user: UserCardUser;
  onFollow?: (userId: string) => Promise<void>;
  onUnfollow?: (userId: string) => Promise<void>;
  onSendPing: (recipientId: string, message: string) => Promise<void>;
}

export function UserCard({ user, onFollow, onUnfollow, onSendPing }: UserCardProps) {
  const router = useRouter();
  const [pingOpen, setPingOpen] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const displayName = user.display_name || user.username || "Anonymous";
  const goalLabel = user.fitness_goal
    ? user.fitness_goal
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;

  async function handleFollowToggle() {
    setFollowLoading(true);
    try {
      if (user.isFollowing) {
        await onUnfollow?.(user.id);
      } else {
        await onFollow?.(user.id);
      }
    } catch {
      toast.error("Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <>
      <Card
        className="cursor-pointer border-border/70 bg-card/85 transition-colors hover:bg-accent/40"
        onClick={() => router.push(`/social/${user.id}`)}
      >
        <CardContent className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <UserCircle2 className="size-11 text-muted-foreground" />
                <PresenceDot
                  userId={user.id}
                  size="sm"
                  className="absolute -bottom-0.5 -right-0.5"
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                {user.username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </p>
                )}
                {user.bio && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {user.bio}
                  </p>
                )}
                {goalLabel && (
                  <Badge variant="secondary" className="mt-1 h-5 rounded-full px-2 text-[10px]">
                    {goalLabel}
                  </Badge>
                )}
              </div>
            </div>

            <div
              className="flex items-center gap-2 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Send ping"
                onClick={() => setPingOpen(true)}
              >
                <Zap className="size-4 text-yellow-500" />
              </Button>
              {(onFollow || onUnfollow) && (
                <Button
                  size="sm"
                  variant={user.isFollowing ? "outline" : "default"}
                  disabled={followLoading}
                  onClick={handleFollowToggle}
                  className="h-8"
                >
                  {user.isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                title="View profile"
                onClick={() => router.push(`/social/${user.id}`)}
              >
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SendPingDialog
        open={pingOpen}
        recipientName={displayName}
        onClose={() => setPingOpen(false)}
        onSend={(msg) => onSendPing(user.id, msg)}
      />
    </>
  );
}
```

---
## FILE: src/app/(app)/dashboard/page.tsx
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";
import { getUserTimezone, getDateInTimezone, getHourInTimezone } from "@/lib/timezone";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Safety-net cleanup: removes active_workout_sessions older than 4 hours.
  // Handles ghost "currently working out" states left by app crashes.
  // Fire-and-forget — dashboard load is never blocked by this.
  // pg_cron (migration 039) is the primary scheduler; this is the fallback.
  void supabase.rpc("cleanup_stale_workouts");

  // ── Timezone-aware date calculations ──────────────────────────────────────
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const todayStr = getDateInTimezone(now, timezone);
  const hourNow = getHourInTimezone(timezone);

  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = getDateInTimezone(yesterdayDate, timezone);

  // ── Parallel data fetching ────────────────────────────────────────────────
  const [
    profileResult,
    workoutSummaryResult,
    nutritionGoalResult,
    nutritionSummaryResult,
    recentFoodsResult,
    intentResult,
    todayWorkoutResult,
    yesterdayWorkoutResult,
  ] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select(
        "display_name, fitness_goal, current_streak, streak_milestones_unlocked, streak_freeze_available, xp, level"
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("get_dashboard_workout_summary", { p_user_id: user.id }),
    supabase
      .from("nutrition_goals")
      .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
      .eq("user_id", user.id)
      .lte("effective_from", todayStr)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_dashboard_nutrition_summary", {
      p_user_id: user.id,
      p_date_str: todayStr,
    }),
    supabase
      .from("food_log")
      .select("logged_at, food_items(id, name, brand)")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(40),
    supabase
      .from("user_intents")
      .select("id, intent_type, intent_payload, intent_for_date, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Lightweight check: did user work out today?
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${todayStr}T00:00:00`)
      .lt("started_at", `${todayStr}T23:59:59.999`)
      .limit(1),
    // Lightweight check: did user work out yesterday?
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${yesterdayStr}T00:00:00`)
      .lt("started_at", `${yesterdayStr}T23:59:59.999`)
      .limit(1),
  ]);

  // ── Profile ───────────────────────────────────────────────────────────────
  const profile =
    profileResult.status === "fulfilled"
      ? (profileResult.value.data as {
          display_name: string | null;
          fitness_goal: string | null;
          current_streak: number;
          streak_milestones_unlocked: number[];
          streak_freeze_available: boolean;
          xp: number;
          level: number;
        } | null)
      : null;

  // ── Workout summary (from RPC) ────────────────────────────────────────────
  type WorkoutSummaryRow = {
    total_sessions: number;
    sessions_7d: number;
    sessions_28d: number;
    avg_volume_28d: number;
    latest_id: string | null;
    latest_name: string | null;
    latest_started_at: string | null;
    latest_duration: number | null;
    latest_volume_kg: number | null;
  };

  const workoutSummary: WorkoutSummaryRow | null =
    workoutSummaryResult.status === "fulfilled"
      ? ((workoutSummaryResult.value.data as WorkoutSummaryRow[] | null)?.[0] ?? null)
      : null;

  const totalSessionCount = workoutSummary?.total_sessions ?? 0;
  const sessions7d = workoutSummary?.sessions_7d ?? 0;
  const sessions28d = workoutSummary?.sessions_28d ?? 0;
  const avgVolumeKg = workoutSummary?.avg_volume_28d ?? 0;

  const lastWorkout = workoutSummary?.latest_id
    ? {
        id: workoutSummary.latest_id,
        name: workoutSummary.latest_name ?? "Workout",
        started_at: workoutSummary.latest_started_at ?? "",
        duration_seconds: workoutSummary.latest_duration,
        total_volume_kg: workoutSummary.latest_volume_kg,
        status: "completed" as const,
      }
    : null;

  // ── Nutrition goal ────────────────────────────────────────────────────────
  type GoalRow = {
    calories_target: number | null;
    protein_g_target: number | null;
    carbs_g_target: number | null;
    fat_g_target: number | null;
  };

  const nutritionGoal: GoalRow | null =
    nutritionGoalResult.status === "fulfilled"
      ? (nutritionGoalResult.value.data as GoalRow | null)
      : null;

  // ── Nutrition summary (from RPC) ──────────────────────────────────────────
  type NutritionSummaryRow = {
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    total_fiber_g: number;
    total_sugar_g: number;
    total_sodium_mg: number;
    total_servings: number;
  };

  const nutritionSummary: NutritionSummaryRow | null =
    nutritionSummaryResult.status === "fulfilled"
      ? ((nutritionSummaryResult.value.data as NutritionSummaryRow[] | null)?.[0] ?? null)
      : null;

  const todayCalories = Number(nutritionSummary?.total_calories ?? 0);
  const todayProtein = Number(nutritionSummary?.total_protein_g ?? 0);
  const todayCarbs = Number(nutritionSummary?.total_carbs_g ?? 0);
  const todayFat = Number(nutritionSummary?.total_fat_g ?? 0);
  const todayFiber = Number(nutritionSummary?.total_fiber_g ?? 0);
  const todaySugar = Number(nutritionSummary?.total_sugar_g ?? 0);
  const todaySodiumMg = Number(nutritionSummary?.total_sodium_mg ?? 0);
  const todayServings = Number(nutritionSummary?.total_servings ?? 0);
  const calorieGoal = nutritionGoal?.calories_target ?? null;

  // ── Recent foods (for quick-add) ──────────────────────────────────────────
  type RecentFoodRow = {
    logged_at: string;
    food_items:
      | { id: string; name: string; brand: string | null }
      | { id: string; name: string; brand: string | null }[]
      | null;
  };

  const recentFoodRows: RecentFoodRow[] =
    recentFoodsResult.status === "fulfilled"
      ? ((recentFoodsResult.value.data ?? []) as RecentFoodRow[])
      : [];

  // ── Active intent ─────────────────────────────────────────────────────────
  type IntentRow = {
    id: string;
    intent_type: string;
    intent_payload: { suggested_goal?: string; suggested_duration_min?: number } | null;
    intent_for_date: string | null;
    status: string;
  };

  const activeIntent: IntentRow | null =
    intentResult.status === "fulfilled"
      ? (intentResult.value.data as IntentRow | null)
      : null;

  // ── Derived values ────────────────────────────────────────────────────────
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Athlete";

  const streak = profile?.current_streak ?? 0;
  const milestonesUnlocked = profile?.streak_milestones_unlocked ?? [];
  const freezeAvailable = profile?.streak_freeze_available ?? false;

  const workedOutToday =
    todayWorkoutResult.status === "fulfilled" &&
    (todayWorkoutResult.value.data?.length ?? 0) > 0;

  const workedOutYesterday =
    yesterdayWorkoutResult.status === "fulfilled" &&
    (yesterdayWorkoutResult.value.data?.length ?? 0) > 0;

  const streakAtRisk = !workedOutToday && streak > 0;
  const momentumUrgency: "low" | "medium" | "high" =
    !streakAtRisk ? "low" : hourNow >= 20 ? "high" : hourNow >= 14 ? "medium" : "low";
  const weeklyMomentumGoal = 4;
  const weeklyProgressPct = Math.min(
    100,
    Math.round((sessions7d / weeklyMomentumGoal) * 100)
  );
  const weeklyAverageSessions = sessions28d / 4;
  const projectedSessions90d = Math.max(0, Math.round(weeklyAverageSessions * 13));
  const projectedVolumeKg = Math.round(projectedSessions90d * avgVolumeKg);

  const quickAddFoods = (() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; brand: string | null }> = [];
    for (const row of recentFoodRows) {
      const food = Array.isArray(row.food_items) ? row.food_items[0] ?? null : row.food_items;
      if (!food || seen.has(food.id)) continue;
      seen.add(food.id);
      result.push(food);
      if (result.length >= 6) break;
    }
    return result;
  })();

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const fatigueSnapshot = await getCachedOrComputeFatigueSnapshot(user.id);

  // Dashboard phase state machine
  type DashboardPhase = "morning" | "pre_workout" | "active" | "post_workout" | "evening";
  let dashboardPhase: DashboardPhase;
  if (workedOutToday) {
    const lastSessionTime = lastWorkout ? new Date(lastWorkout.started_at).getTime() : 0;
    const hoursSinceLastWorkout = (Date.now() - lastSessionTime) / (1000 * 60 * 60);
    dashboardPhase = hoursSinceLastWorkout <= 2 ? "post_workout" : "evening";
  } else if (hourNow < 12) {
    dashboardPhase = "morning";
  } else if (hourNow < 20) {
    dashboardPhase = "pre_workout";
  } else {
    dashboardPhase = "evening";
  }

  return (
    <DashboardContent
      userId={user.id}
      displayName={displayName}
      todayFormatted={todayFormatted}
      todayStr={todayStr}
      level={profile?.level ?? 1}
      xp={profile?.xp ?? 0}
      streak={streak}
      milestonesUnlocked={milestonesUnlocked}
      freezeAvailable={freezeAvailable}
      totalSessionCount={totalSessionCount}
      thisWeekSessionCount={sessions7d}
      lastWorkout={lastWorkout}
      workedOutToday={workedOutToday}
      workedOutYesterday={workedOutYesterday}
      streakAtRisk={streakAtRisk}
      momentumUrgency={momentumUrgency}
      weeklyMomentumGoal={weeklyMomentumGoal}
      weeklyProgressPct={weeklyProgressPct}
      weeklyAverageSessions={weeklyAverageSessions}
      projectedSessions90d={projectedSessions90d}
      projectedVolumeKg={projectedVolumeKg}
      calorieGoal={calorieGoal}
      todayCalories={todayCalories}
      todayProtein={todayProtein}
      todayCarbs={todayCarbs}
      todayFat={todayFat}
      todayFiber={todayFiber}
      todaySugar={todaySugar}
      todaySodiumMg={todaySodiumMg}
      todayServings={todayServings}
      nutritionGoal={nutritionGoal}
      activeIntent={activeIntent}
      quickAddFoods={quickAddFoods}
      fatigueSnapshot={fatigueSnapshot}
      dashboardPhase={dashboardPhase}
    />
  );
}
```

---
## FILE: src/app/(app)/workout/page.tsx
```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Clock3, NotebookPen, Plus, Save, Dumbbell, Zap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import {
  trackSessionIntentSet,
} from "@/lib/retention-events";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import type { ActiveWorkout, Exercise, WorkoutSet } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExerciseSwapSheet } from "@/components/workout/exercise-swap-sheet";
import { useExerciseTrendlines } from "@/hooks/use-exercise-trendlines";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, kgToLbs } from "@/lib/units";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";
import {
  isMissingTableError,
  slugify,
  normalizeEquipment,
  resolveExerciseMediaUrl,
  makeCustomExercise,
} from "@/lib/workout/exercise-resolver";
import { calcSuggestedWeight } from "@/lib/progressive-overload";
import { RestTimerPill } from "@/components/workout/rest-timer-pill";
import { SaveTemplateDialog } from "@/components/workout/save-template-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { ExerciseSelectionCard } from "@/components/workout/exercise-selection-card";
import { WorkoutCompleteCelebration } from "@/components/workout/workout-complete-celebration";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";

// Extracted hooks
import { useGhostSession } from "@/hooks/workout/use-ghost-session";
import { useExerciseSwap } from "@/hooks/workout/use-exercise-swap";
import { useWorkoutCompletion } from "@/hooks/workout/use-workout-completion";
import { useTemplateActions, type WorkoutTemplate } from "@/hooks/workout/use-template-actions";

// Extracted components
import { WorkoutHeader, ElapsedTime } from "@/components/workout/workout-header";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { WorkoutCompletionDialog } from "@/components/workout/workout-completion-dialog";
import { TemplateManagerPanel } from "@/components/workout/template-manager-panel";
import { QuickStartPanel } from "@/components/workout/quick-start-panel";
import { AI_COACH_ENABLED } from "@/lib/features";
import { VoiceCommandBar } from "@/components/coach/voice-command-bar";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const TEMPLATE_LIKES_KEY = "workout_template_likes_v1";

/** Returns true when viewport width <= 639 px (Tailwind `sm` breakpoint). */
function useIsSmallScreen(): boolean {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsSmall(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isSmall;
}

export default function WorkoutPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [dbFeaturesAvailable, setDbFeaturesAvailable] = useState(true);

  const [presetId, setPresetId] = useState<WorkoutPresetId>("upper-body-strength");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [workoutName, setWorkoutName] = useState("Upper Body Strength");
  const [setupTab, setSetupTab] = useState<"templates" | "quick">("templates");
  const [quickFilter, setQuickFilter] = useState<string>("All");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(new Set());
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<{
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null>(null);

  const isSmallScreen = useIsSmallScreen();

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [liftPickerOpen, setLiftPickerOpen] = useState(false);
  const [liftSearch, setLiftSearch] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const [customName, setCustomName] = useState("");
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>("full_body");
  const [customEquipment, setCustomEquipment] = useState("bodyweight");
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);

  // API exercise search state
  const [apiExercises, setApiExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const searchRequestSeq = useRef(0);

  const [previousByExerciseId, setPreviousByExerciseId] = useState<
    Record<string, Array<{ reps: number | null; weight: number | null }>>
  >({});
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [exerciseLastPerformance, setExerciseLastPerformance] = useState<
    Record<string, { reps: number | null; weight: number | null; performedAt: string | null }>
  >({});

  // DEV: Uncomment to verify WorkoutPage render frequency.
  // Should NOT increment every second -- only on user interactions.
  // if (process.env.NODE_ENV === 'development') console.count('[WorkoutPage] render');

  // Scoped selectors prevent re-renders from unrelated store slices
  const {
    activeWorkout,
    isWorkoutActive,
    startWorkout,
    loadWorkoutForEdit,
    cancelWorkout,
    finishWorkout,
    addExercise,
    removeExercise,
    swapExercise,
    addSet,
    updateSet,
    removeSet,
    completeSet,
    setExerciseNote,
    setWorkoutNote,
    updateWorkoutName,
  } = useWorkoutStore(
    useShallow((s) => ({
      activeWorkout: s.activeWorkout,
      isWorkoutActive: s.isWorkoutActive,
      startWorkout: s.startWorkout,
      loadWorkoutForEdit: s.loadWorkoutForEdit,
      cancelWorkout: s.cancelWorkout,
      finishWorkout: s.finishWorkout,
      addExercise: s.addExercise,
      removeExercise: s.removeExercise,
      swapExercise: s.swapExercise,
      addSet: s.addSet,
      updateSet: s.updateSet,
      removeSet: s.removeSet,
      completeSet: s.completeSet,
      setExerciseNote: s.setExerciseNote,
      setWorkoutNote: s.setWorkoutNote,
      updateWorkoutName: s.updateWorkoutName,
    }))
  );

  const startTimer = useTimerStore((state) => state.startTimer);
  const getActiveTimers = useTimerStore((state) => state.getActiveTimers);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const { sendTemplate } = useSharedItems(userId);
  const { preference, unitLabel } = useUnitPreferenceStore();

  const toDisplayWeight = useCallback(
    (kg: number) => weightToDisplay(kg, preference === "imperial", 1),
    [preference]
  );

  const toDisplayVolume = useCallback(
    (kgVolume: number) =>
      preference === "imperial"
        ? Math.round(kgToLbs(kgVolume))
        : Math.round(kgVolume),
    [preference]
  );

  const allExercises = useMemo(
    () => [...customExercises, ...apiExercises],
    [customExercises, apiExercises]
  );

  const selectedExerciseIds = useMemo(
    () =>
      new Set(activeWorkout?.exercises.map((workoutExercise) => workoutExercise.exercise.id) ?? []),
    [activeWorkout]
  );

  const filteredByMuscleGroup = useMemo(
    () => allExercises.filter((exercise) => exercise.muscle_group === selectedMuscleGroup),
    [allExercises, selectedMuscleGroup]
  );

  const filteredExercises = useMemo(() => {
    const q = liftSearch.trim().toLowerCase();
    return filteredByMuscleGroup
      .filter((exercise) => (q.length === 0 ? true : exercise.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [liftSearch, filteredByMuscleGroup]);


  const selectedExercise = useMemo(
    () => allExercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [allExercises, selectedExerciseId]
  );

  const plannerStats = useMemo(() => {
    if (!activeWorkout) {
      return { exercises: 0, totalSets: 0, completedSets: 0, totalVolumeKg: 0 };
    }

    const allSets = activeWorkout.exercises.flatMap((exerciseBlock) => exerciseBlock.sets);
    const completedSets = allSets.filter((set) => set.completed).length;
    const totalVolumeKg = allSets.reduce(
      (sum, set) => sum + (set.weight_kg ?? 0) * (set.reps ?? 0),
      0
    );

    return {
      exercises: activeWorkout.exercises.length,
      totalSets: allSets.length,
      completedSets,
      totalVolumeKg,
    };
  }, [activeWorkout]);
  const completionProgressPct =
    plannerStats.totalSets > 0
      ? Math.min(100, Math.round((plannerStats.completedSets / plannerStats.totalSets) * 100))
      : 0;

  // --- Extracted hooks ---

  // Ghost session: loads ghost data for selected template
  const {
    ghostWorkoutData,
    ghostIsLoading,
    suggestedWeightsByKey,
    patchGhostForExercise,
  } = useGhostSession(supabase, userId, selectedTemplateId, preference);

  // Exercise swap: manages swap sheet state + targeted ghost refetch
  const {
    swapSheetIndex,
    setSwapSheetIndex,
    handleSwapExercise,
  } = useExerciseSwap(swapExercise, patchGhostForExercise);

  // Workout completion: finish, cancel, celebration, RPE
  const {
    celebrationStats,
    showCelebration,
    levelUpData,
    sessionRpePromptOpen,
    setSessionRpePromptOpen,
    sessionRpeValue,
    setSessionRpeValue,
    savingSessionRpe,
    handleFinishWorkout,
    handleCancelWorkout,
    handleCloseWorkoutCelebration,
    handleCloseLevelUp,
    handleSaveSessionRpe,
  } = useWorkoutCompletion({
    supabase,
    userId,
    finishWorkout,
    cancelWorkout,
    previousByExerciseId,
    ghostWorkoutData,
    toDisplayWeight,
    toDisplayVolume,
    unitLabel,
    setDbFeaturesAvailable,
  });

  // Stable list of active exercise IDs for sparklines
  const activeExerciseIds = useMemo(
    () => activeWorkout?.exercises.map((e) => e.exercise.id) ?? [],
    [activeWorkout]
  );

  // Sparkline trendlines -- only fetches when workout is active
  const exerciseTrendlines = useExerciseTrendlines(activeExerciseIds, userId, isWorkoutActive);

  const loadTemplates = useCallback(async (currentUserId: string) => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from("workout_templates")
      .select("id,name,primary_muscle_group")
      .eq("user_id", currentUserId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        setDbFeaturesAvailable(false);
      } else {
        toast.error(error.message);
      }
      setLoadingTemplates(false);
      return;
    }

    setDbFeaturesAvailable(true);
    setTemplates(data ?? []);
    setLoadingTemplates(false);
  }, [supabase]);

  // iOS Safari fallback: AudioContext cannot beep without a prior user gesture
  useEffect(() => {
    function handleRestComplete(e: Event) {
      const { exerciseName } =
        (e as CustomEvent<{ exerciseName: string }>).detail ?? {};
      toast(
        exerciseName ? `Rest complete -- ${exerciseName}` : "Rest period complete",
        { description: "Time to get back to it!", duration: 5000 }
      );
    }
    window.addEventListener("rest-timer-complete", handleRestComplete);
    return () => window.removeEventListener("rest-timer-complete", handleRestComplete);
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;
      setUserId(user.id);
      await loadTemplates(user.id);
    }

    init();

    return () => {
      active = false;
    };
  }, [loadTemplates, supabase]);

  useEffect(() => {
    try {
      const likeRaw = localStorage.getItem(TEMPLATE_LIKES_KEY);
      const nextLikes = likeRaw ? (JSON.parse(likeRaw) as string[]) : [];
      setLikedTemplateIds(new Set(nextLikes));
    } catch {
      setLikedTemplateIds(new Set());
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_LIKES_KEY, JSON.stringify(Array.from(likedTemplateIds)));
    } catch {
      // no-op
    }
  }, [likedTemplateIds]);

  // Fetch exercises from API with debounced search
  useEffect(() => {
    const controller = new AbortController();
    const seq = ++searchRequestSeq.current;

    const timeoutId = setTimeout(async () => {
      setLoadingExercises(true);

      try {
        const params = new URLSearchParams();
        const query = liftSearch.trim();

        if (query.length > 0) {
          params.set("query", query);
        }
        params.set("muscle_groups", selectedMuscleGroup);

        const response = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch exercises");

        const data = await response.json();

        if (seq !== searchRequestSeq.current) return;
        setApiExercises(data.exercises ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching exercises:", error);
        toast.error("Failed to load exercises from database");
      } finally {
        if (seq === searchRequestSeq.current) {
          setLoadingExercises(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort("Search cancelled");
    };
  }, [liftSearch, selectedMuscleGroup]);

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (template) {
      setWorkoutName(template.name);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    async function loadPreviousPerformance() {
      if (!userId || !activeWorkout) {
        setPreviousByExerciseId({});
        return;
      }

      const exerciseIds = activeWorkout.exercises.map(e => e.exercise.id);
      if (exerciseIds.length === 0) {
        setPreviousByExerciseId({});
        return;
      }

      const { data: completedSets, error } = await supabase
        .from("workout_sets")
        .select(
          "exercise_id,set_number,reps,weight_kg,completed_at,session_id,workout_sessions!inner(id,user_id,status,completed_at)"
        )
        .eq("workout_sessions.user_id", userId)
        .eq("workout_sessions.status", "completed")
        .not("completed_at", "is", null)
        .in("exercise_id", exerciseIds);

      if (error) {
        console.error("Error loading previous performance:", error);
        setPreviousByExerciseId({});
        return;
      }

      type WorkoutSessionLink = { completed_at: string | null };
      type CompletedSetRow = {
        exercise_id: string;
        set_number: number | null;
        reps: number | null;
        weight_kg: number | null;
        session_id: string;
        workout_sessions: WorkoutSessionLink | WorkoutSessionLink[] | null;
      };

      const rows = ((completedSets ?? []) as CompletedSetRow[])
        .map((row) => {
          const session = Array.isArray(row.workout_sessions)
            ? row.workout_sessions[0]
            : row.workout_sessions;
          return {
            ...row,
            completed_at: session?.completed_at ?? null,
          };
        })
        .filter((row) => row.completed_at != null)
        .filter((row) => row.session_id != null && row.set_number != null)
        .sort((a, b) => {
          const aCompleted = new Date(a.completed_at ?? 0).getTime();
          const bCompleted = new Date(b.completed_at ?? 0).getTime();
          if (aCompleted !== bCompleted) return bCompleted - aCompleted;
          const sessionCmp = String(b.session_id).localeCompare(String(a.session_id));
          if (sessionCmp !== 0) return sessionCmp;
          return (a.set_number ?? 0) - (b.set_number ?? 0);
        });

      const latestSessionByExercise = new Map<string, string>();
      for (const row of rows) {
        if (!latestSessionByExercise.has(row.exercise_id)) {
          latestSessionByExercise.set(row.exercise_id, row.session_id);
        }
      }

      const detailedByExercise: Record<
        string,
        Array<{ setNumber: number; reps: number | null; weight: number | null }>
      > = {};
      for (const row of rows) {
        const latestSessionId = latestSessionByExercise.get(row.exercise_id);
        if (!latestSessionId || row.session_id !== latestSessionId) continue;
        if (!detailedByExercise[row.exercise_id]) {
          detailedByExercise[row.exercise_id] = [];
        }
        detailedByExercise[row.exercise_id].push({
          setNumber: row.set_number ?? 0,
          reps: row.reps ?? null,
          weight: row.weight_kg ?? null,
        });
      }

      const byExercise: Record<string, Array<{ reps: number | null; weight: number | null }>> = {};
      for (const exerciseId of Object.keys(detailedByExercise)) {
        byExercise[exerciseId] = detailedByExercise[exerciseId]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((set) => ({ reps: set.reps, weight: set.weight }));
      }

      setPreviousByExerciseId(byExercise);
    }

    void loadPreviousPerformance();
  }, [activeWorkout, supabase, userId]);

  useEffect(() => {
    async function loadPickerPerformance() {
      if (!userId || filteredExercises.length === 0) {
        setExerciseLastPerformance({});
        return;
      }

      const ids = filteredExercises.slice(0, 120).map((exercise) => exercise.id);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("user_exercise_last_performance")
        .select("exercise_id,best_set,last_performed_at")
        .eq("user_id", userId)
        .in("exercise_id", ids);

      if (error) return;

      const map: Record<string, { reps: number | null; weight: number | null; performedAt: string | null }> = {};
      for (const row of data ?? []) {
        const best = row.best_set as { reps?: number | null; weight_kg?: number | null };
        map[row.exercise_id] = {
          reps: best?.reps ?? null,
          weight: best?.weight_kg ?? null,
          performedAt: row.last_performed_at ?? null,
        };
      }
      setExerciseLastPerformance(map);
    }

    void loadPickerPerformance();
  }, [filteredExercises, supabase, userId]);

  function getPrimaryBenefit(exercise: Exercise) {
    const group = MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ?? exercise.muscle_group;
    if (exercise.category === "compound") return `Build maximal ${group.toLowerCase()} strength with full-body coordination.`;
    if (exercise.category === "cardio") return `Increase conditioning capacity and repeat-effort endurance.`;
    if (exercise.category === "stretch") return `Improve mobility quality and position control for safer loading.`;
    return `Target ${group.toLowerCase()} with precision for hypertrophy and weak-point development.`;
  }

  function getCoachingCues(exercise: Exercise) {
    if (exercise.form_tips?.length) return exercise.form_tips;
    if (exercise.instructions) {
      return exercise.instructions
        .split(/\n+|\. /)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2);
    }
    return [];
  }

  // Auto-start workout when coming from launcher or adaptive
  useEffect(() => {
    if (hasAutoStarted || isWorkoutActive || loadingTemplates) return;

    const fromLauncher = searchParams.get('from_launcher');
    const fromAdaptive = searchParams.get('from_adaptive');
    if (!fromLauncher && !fromAdaptive) return;

    const templateId = searchParams.get('template_id');
    async function autoStart() {
      setHasAutoStarted(true);

      if (templateId && templates.length > 0) {
        const template = templates.find(t => t.id === templateId);
        if (!template) {
          console.error('Template not found:', templateId);
          toast.error('Template not found');
          return;
        }

        setSelectedTemplateId(templateId);
        setWorkoutName(template.name);
        startWorkout(template.name, userId!, templateId);

        try {
          const { data: templateExercises, error } = await supabase
            .from("template_exercises")
            .select(
              "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
            )
            .eq("template_id", templateId)
            .order("sort_order", { ascending: true });

          if (error) throw error;

          for (const row of templateExercises ?? []) {
            const exercise = row.exercises as unknown as Exercise | null;
            if (!exercise) continue;

            addExercise(exercise);

            const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
            if (!exerciseIndex) continue;

            const index = exerciseIndex - 1;
            const setsToCreate = Math.max(1, row.target_sets ?? 1);
            const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;

            updateSet(index, 0, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: row.target_weight_kg ?? null,
              rest_seconds: row.rest_seconds ?? 90,
            });

            for (let i = 1; i < setsToCreate; i += 1) {
              addSet(index);
              updateSet(index, i, {
                reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
                weight_kg: row.target_weight_kg ?? null,
                rest_seconds: row.rest_seconds ?? 90,
              });
            }
          }

          const source = fromAdaptive ? 'adaptive system' : 'launcher';
          await applyAutofillFromHistory();
          toast.success(`Started ${template.name} from ${source}`);
        } catch (error) {
          console.error('Template load error:', error);
          toast.error('Failed to load template');
        }
        return;
      }

      const storageKey = fromAdaptive ? 'adaptive_workout' : 'launcher_prediction';
      const workoutDataRaw = sessionStorage.getItem(storageKey);
      if (!workoutDataRaw) return;

      try {
        const launcherData = JSON.parse(workoutDataRaw);
        sessionStorage.removeItem(storageKey);

        setWorkoutName(launcherData.template_name);
        startWorkout(launcherData.template_name, userId!, undefined);

        for (const launcherEx of launcherData.exercises ?? []) {
          const exerciseData = launcherEx.exercise;
          if (!exerciseData) continue;

          const exercise = allExercises.find(ex => ex.name === exerciseData.name);
          if (!exercise) {
            console.warn(`Exercise not found: ${exerciseData.name}`);
            continue;
          }

          addExercise(exercise);

          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;

          const index = exerciseIndex - 1;
          const setsToCreate = launcherEx.target_sets || 3;
          const lastSet = launcherEx.last_performance?.[0];
          const targetReps = lastSet?.reps || launcherEx.target_reps || 10;
          const targetWeight = lastSet?.weight_kg || launcherEx.target_weight_kg || null;

          updateSet(index, 0, {
            reps: targetReps,
            weight_kg: targetWeight,
            rest_seconds: 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: targetReps,
              weight_kg: targetWeight,
              rest_seconds: 90,
            });
          }
        }

        await applyAutofillFromHistory();
        toast.success(`Started ${launcherData.template_name} from launcher`);
      } catch (error) {
        console.error('Preset load error:', error);
        sessionStorage.removeItem('launcher_prediction');
      }
    }

    autoStart();
  }, [searchParams, templates, loadingTemplates, isWorkoutActive, hasAutoStarted, startWorkout, addExercise, updateSet, addSet, allExercises, supabase]);

  function handlePresetChange(value: WorkoutPresetId) {
    setPresetId(value);
    if (value === "custom") return;

    const preset = POPULAR_WORKOUTS.find((item) => item.id === value);
    if (preset) {
      setWorkoutName(preset.defaultName);
    }
  }

  function handleToggleTemplateLike(templateId: string) {
    setLikedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  // Template CRUD actions (extracted hook)
  const {
    templateActionBusyId,
    handleSendTemplate,
    handleEditTemplate,
    handleCopyTemplate,
    handleDeleteTemplate,
  } = useTemplateActions({
    supabase,
    userId,
    loadTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    setLikedTemplateIds,
    loadWorkoutForEdit,
    addExercise,
    updateSet,
    addSet,
    setSendingTemplate,
    setSendDialogOpen,
  });

  const EXERCISE_SELECT_COLS =
    "id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url";

  function exerciseKey(ex: Exercise) {
    return `${ex.name}::${ex.muscle_group}`;
  }

  async function ensureExerciseRecord(exercise: Exercise) {
    const candidateSlug = `${slugify(exercise.name)}-${exercise.muscle_group}`;

    const { data: bySlug, error: slugError } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (slugError) {
      if (isMissingTableError(slugError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
    }

    if (bySlug) return bySlug as unknown as Exercise;

    const { data: byName } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .eq("name", exercise.name)
      .eq("muscle_group", exercise.muscle_group)
      .limit(1)
      .maybeSingle();

    if (byName) return byName as unknown as Exercise;

    if (!userId) throw new Error("No user found.");

    const { data: inserted, error: insertError } = await supabase
      .from("exercises")
      .insert({
        name: exercise.name,
        slug: candidateSlug,
        muscle_group: exercise.muscle_group,
        equipment: normalizeEquipment(exercise.equipment),
        category: exercise.category,
        instructions: exercise.instructions,
        form_tips: exercise.form_tips,
        image_url: exercise.image_url,
        is_custom: true,
        created_by: userId,
      })
      .select(EXERCISE_SELECT_COLS)
      .single();

    if (insertError) {
      if (isMissingTableError(insertError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
      const { data: reFetch } = await supabase
        .from("exercises")
        .select(EXERCISE_SELECT_COLS)
        .eq("slug", candidateSlug)
        .maybeSingle();
      if (reFetch) return reFetch as unknown as Exercise;
      return exercise;
    }

    return inserted as unknown as Exercise;
  }

  /** Batch-resolve exercises: 2-3 DB queries instead of N*2 sequential. */
  async function ensureExerciseRecordsBatch(
    exercises: Exercise[]
  ): Promise<Map<string, Exercise>> {
    const results = new Map<string, Exercise>();
    if (!exercises.length) return results;

    // Build slug → original exercise mapping
    const slugToOriginal = new Map<string, Exercise>();
    for (const ex of exercises) {
      slugToOriginal.set(`${slugify(ex.name)}-${ex.muscle_group}`, ex);
    }

    // Step 1: Batch lookup by slug (single query)
    const slugs = [...slugToOriginal.keys()];
    const { data: bySlug, error: slugError } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .in("slug", slugs);

    if (slugError && isMissingTableError(slugError)) {
      setDbFeaturesAvailable(false);
      for (const ex of exercises) results.set(exerciseKey(ex), ex);
      return results;
    }

    for (const row of bySlug ?? []) {
      const original = slugToOriginal.get((row as any).slug);
      if (original) results.set(exerciseKey(original), row as unknown as Exercise);
    }

    // Step 2: For unfound, batch lookup by name (single query)
    const unfound = exercises.filter((ex) => !results.has(exerciseKey(ex)));
    if (unfound.length) {
      const names = [...new Set(unfound.map((ex) => ex.name))];
      const { data: byName } = await supabase
        .from("exercises")
        .select(EXERCISE_SELECT_COLS)
        .in("name", names);

      const nameGroupIndex = new Map<string, Exercise>();
      for (const row of byName ?? []) {
        const r = row as unknown as Exercise;
        nameGroupIndex.set(`${r.name}::${r.muscle_group}`, r);
      }
      for (const ex of unfound) {
        const found = nameGroupIndex.get(exerciseKey(ex));
        if (found) results.set(exerciseKey(ex), found);
      }
    }

    // Step 3: For still unfound, batch insert
    const stillUnfound = exercises.filter((ex) => !results.has(exerciseKey(ex)));
    if (stillUnfound.length && userId) {
      const toInsert = stillUnfound.map((ex) => ({
        name: ex.name,
        slug: `${slugify(ex.name)}-${ex.muscle_group}`,
        muscle_group: ex.muscle_group,
        equipment: normalizeEquipment(ex.equipment),
        category: ex.category,
        instructions: ex.instructions,
        form_tips: ex.form_tips,
        image_url: ex.image_url,
        is_custom: true,
        created_by: userId,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("exercises")
        .insert(toInsert)
        .select(EXERCISE_SELECT_COLS);

      if (insertError) {
        if (isMissingTableError(insertError)) {
          setDbFeaturesAvailable(false);
          for (const ex of stillUnfound) results.set(exerciseKey(ex), ex);
          return results;
        }
        // Race condition: re-fetch by slugs
        const conflictSlugs = stillUnfound.map(
          (ex) => `${slugify(ex.name)}-${ex.muscle_group}`
        );
        const { data: reFetched } = await supabase
          .from("exercises")
          .select(EXERCISE_SELECT_COLS)
          .in("slug", conflictSlugs);
        for (const row of reFetched ?? []) {
          const original = slugToOriginal.get((row as any).slug);
          if (original) results.set(exerciseKey(original), row as unknown as Exercise);
        }
        for (const ex of stillUnfound) {
          if (!results.has(exerciseKey(ex))) results.set(exerciseKey(ex), ex);
        }
      } else {
        for (const row of inserted ?? []) {
          const original = slugToOriginal.get((row as any).slug);
          if (original) results.set(exerciseKey(original), row as unknown as Exercise);
        }
      }
    } else {
      for (const ex of stillUnfound) results.set(exerciseKey(ex), ex);
    }

    return results;
  }

  async function addExerciseToWorkout(
    exercise: Exercise,
    options?: {
      targetSets?: number | null;
      targetReps?: string | null;
      targetWeight?: number | null;
      restSeconds?: number | null;
      silent?: boolean;
    }
  ) {
    const source = await ensureExerciseRecord(exercise);

    if (selectedExerciseIds.has(source.id)) {
      if (!options?.silent) toast.message(`${source.name} is already in this session`);
      return;
    }

    addExercise(source);

    const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
    if (!exerciseIndex) return;

    const index = exerciseIndex - 1;

    const setsToCreate = Math.max(1, options?.targetSets ?? 1);
    const parsedReps = options?.targetReps ? Number.parseInt(options.targetReps, 10) : null;

    updateSet(index, 0, {
      reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
      weight_kg: options?.targetWeight ?? null,
      rest_seconds: options?.restSeconds ?? 90,
    });

    for (let i = 1; i < setsToCreate; i += 1) {
      addSet(index);
      updateSet(index, i, {
        reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
        weight_kg: options?.targetWeight ?? null,
        rest_seconds: options?.restSeconds ?? 90,
      });
    }

    if (!options?.silent) toast.success(`Added ${source.name}`);
  }

  /**
   * Smart autofill: after all exercises are added to the active workout,
   * pre-fill each set's reps from the user's last session and bump the weight
   * by a standard plate increment. Only fires once per workout start.
   */
  async function applyAutofillFromHistory() {
    if (!userId) return;
    const snapshot = useWorkoutStore.getState().activeWorkout;
    if (!snapshot || snapshot.exercises.length === 0) return;

    const exIds = snapshot.exercises.map((e) => e.exercise.id);

    type PrevRow = {
      exercise_id: string;
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
      session_id: string;
      workout_sessions:
        | { completed_at: string | null }
        | { completed_at: string | null }[]
        | null;
    };

    const { data: prevData } = await supabase
      .from("workout_sets")
      .select(
        "exercise_id,set_number,reps,weight_kg,session_id,workout_sessions!inner(user_id,status,completed_at)"
      )
      .eq("workout_sessions.user_id", userId)
      .eq("workout_sessions.status", "completed")
      .not("workout_sessions.completed_at", "is", null)
      .in("exercise_id", exIds);

    if (!prevData || prevData.length === 0) return;

    const rows = (prevData as PrevRow[])
      .map((row) => {
        const sess = Array.isArray(row.workout_sessions)
          ? row.workout_sessions[0]
          : row.workout_sessions;
        return { ...row, completed_at: sess?.completed_at ?? null };
      })
      .filter((r) => r.completed_at != null)
      .sort((a, b) => {
        const ta = new Date(a.completed_at!).getTime();
        const tb = new Date(b.completed_at!).getTime();
        return ta !== tb
          ? tb - ta
          : String(b.session_id).localeCompare(String(a.session_id));
      });

    const latestSession = new Map<string, string>();
    for (const r of rows) {
      if (!latestSession.has(r.exercise_id)) latestSession.set(r.exercise_id, r.session_id);
    }

    const byEx: Record<string, Array<{ setNumber: number; reps: number | null; weight: number | null }>> = {};
    for (const r of rows) {
      if (latestSession.get(r.exercise_id) !== r.session_id) continue;
      if (!byEx[r.exercise_id]) byEx[r.exercise_id] = [];
      byEx[r.exercise_id].push({ setNumber: r.set_number, reps: r.reps, weight: r.weight_kg });
    }
    for (const sets of Object.values(byEx)) {
      sets.sort((a, b) => a.setNumber - b.setNumber);
    }

    const { preference: pref } = useUnitPreferenceStore.getState();

    snapshot.exercises.forEach((exBlock, exIdx) => {
      const prevSets = byEx[exBlock.exercise.id];
      if (!prevSets) return;
      exBlock.sets.forEach((set, setIdx) => {
        if (set.completed) return;
        const prev = prevSets[setIdx];
        if (!prev) return;
        const updates: Partial<WorkoutSet> = {};
        if (prev.reps != null) updates.reps = prev.reps;
        if (prev.weight != null) updates.weight_kg = calcSuggestedWeight(prev.weight, pref);
        if (Object.keys(updates).length > 0) updateSet(exIdx, setIdx, updates);
      });
    });
  }

  async function handleStartWorkout() {
    const name = workoutName.trim() || "Workout";
    const activeTemplateId = selectedTemplateId === "none" ? undefined : selectedTemplateId;

    if (setupTab === "templates") {
      if (activeTemplateId) {
        const tpl = templates.find((t) => t.id === activeTemplateId);
        const categoryToUse = tpl?.primary_muscle_group ?? (pendingCategories.length > 0 ? pendingCategories.join(",") : null);
        if (!categoryToUse) {
          toast.error("Please select a workout type before starting.");
          return;
        }
        if (!tpl?.primary_muscle_group && pendingCategories.length > 0) {
          const joined = pendingCategories.join(",");
          await supabase
            .from("workout_templates")
            .update({ primary_muscle_group: joined })
            .eq("id", activeTemplateId);
          setTemplates((prev) =>
            prev.map((t) => t.id === activeTemplateId ? { ...t, primary_muscle_group: joined } : t)
          );
        }
      } else {
        if (pendingCategories.length === 0) {
          toast.error("Please select a workout type before starting.");
          return;
        }
      }
    }

    if (!userId) return;
    startWorkout(name, userId, activeTemplateId);
    if (userId) {
      void trackSessionIntentSet(supabase, userId, {
        workout_name: name,
        template_id: activeTemplateId ?? null,
        source: activeTemplateId ? "template" : presetId,
      });
    }

    try {
      if (activeTemplateId) {
        const { data: templateExercises, error } = await supabase
          .from("template_exercises")
          .select(
            "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
          )
          .eq("template_id", activeTemplateId)
          .order("sort_order", { ascending: true });

        if (error) {
          if (isMissingTableError(error)) {
            setDbFeaturesAvailable(false);
            toast.message(
              "Templates are unavailable until Supabase migrations are applied. Starting empty session."
            );
            return;
          }
          throw error;
        }

        const rawExercises = (templateExercises ?? [])
          .map((row) => ({ exercise: row.exercises as unknown as Exercise | null, row }))
          .filter((r): r is { exercise: Exercise; row: typeof templateExercises extends (infer T)[] | null ? T : never } => r.exercise != null);

        const resolved = await ensureExerciseRecordsBatch(rawExercises.map((r) => r.exercise));

        for (const { exercise, row } of rawExercises) {
          const source = resolved.get(exerciseKey(exercise)) ?? exercise;
          if (selectedExerciseIds.has(source.id)) continue;

          addExercise(source);
          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;
          const index = exerciseIndex - 1;

          const setsToCreate = Math.max(1, row.target_sets ?? 1);
          const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;

          updateSet(index, 0, {
            reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            weight_kg: row.target_weight_kg ?? null,
            rest_seconds: row.rest_seconds ?? 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: row.target_weight_kg ?? null,
              rest_seconds: row.rest_seconds ?? 90,
            });
          }
        }

        await applyAutofillFromHistory();
        toast.success(`Started ${name} from saved template`);
        return;
      }

      if (presetId !== "custom") {
        const preset = POPULAR_WORKOUTS.find((item) => item.id === presetId);
        const liftsWithExercises = (preset?.lifts ?? [])
          .map((lift) => ({ lift, exercise: allExercises.find((item) => item.name === lift.name) }))
          .filter((r): r is { lift: typeof r.lift; exercise: Exercise } => r.exercise != null);

        const resolved = await ensureExerciseRecordsBatch(liftsWithExercises.map((r) => r.exercise));

        for (const { lift, exercise } of liftsWithExercises) {
          const source = resolved.get(exerciseKey(exercise)) ?? exercise;
          if (selectedExerciseIds.has(source.id)) continue;

          addExercise(source);
          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;
          const index = exerciseIndex - 1;

          const setsToCreate = Math.max(1, lift.sets ?? 1);
          const parsedReps = lift.reps ? Number.parseInt(lift.reps, 10) : null;

          updateSet(index, 0, {
            reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            weight_kg: null,
            rest_seconds: 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: null,
              rest_seconds: 90,
            });
          }
        }
      }

      await applyAutofillFromHistory();
      toast.success(`Started ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workout source";
      toast.error(message);
    }
  }

  async function handleAddSelectedExercise() {
    if (!selectedExercise) {
      toast.error("Choose a lift first.");
      return;
    }

    try {
      await addExerciseToWorkout(selectedExercise);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add exercise.";
      toast.error(message);
    }
  }

  async function handleCreateCustomExercise() {
    const name = customName.trim();
    if (name.length < 3) {
      toast.error("Custom lift name must be at least 3 characters.");
      return;
    }

    const duplicate = allExercises.find(
      (exercise) =>
        exercise.muscle_group === customMuscleGroup &&
        exercise.name.toLowerCase() === name.toLowerCase()
    );

    try {
      if (duplicate) {
        await addExerciseToWorkout(duplicate);
        setCustomName("");
        toast.message("That lift already exists, added it to your workout.");
        return;
      }

      const customExercise = makeCustomExercise(name, customMuscleGroup, customEquipment);
      setCustomExercises((current) => [customExercise, ...current]);
      await addExerciseToWorkout(customExercise);

      setSelectedMuscleGroup(customMuscleGroup);
      setSelectedExerciseId(customExercise.id);
      setCustomName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create custom lift.";
      toast.error(message);
    }
  }

  function handleOpenSaveTemplate() {
    if (!activeWorkout || !userId) {
      toast.error("Start a workout first.");
      return;
    }
    setSaveTemplateDialogOpen(true);
  }

  async function handleSaveTemplate(templateName: string, isPublic: boolean, difficulty: string = "grind", categories: string[] = []) {
    if (!activeWorkout || !userId) {
      toast.error("Start a workout first.");
      return;
    }

    try {
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to ensure profile exists:", err);
    }

    const { data: createdTemplate, error: templateError } = await supabase
      .from("workout_templates")
      .insert({
        user_id: userId,
        name: templateName.trim(),
        description: `Saved from ${activeWorkout.name}`,
        is_public: isPublic,
        difficulty_level: difficulty,
        primary_muscle_group: categories.length > 0 ? categories.join(",") : null,
      })
      .select("id")
      .single();

    if (templateError || !createdTemplate) {
      if (templateError && isMissingTableError(templateError)) {
        setDbFeaturesAvailable(false);
        toast.error("Template tables are missing in Supabase. Run migrations first.");
        return;
      }
      toast.error(templateError?.message ?? "Could not save template.");
      return;
    }

    const rows = activeWorkout.exercises.map((exerciseBlock, index) => {
      const firstSet = exerciseBlock.sets[0];
      return {
        template_id: createdTemplate.id,
        exercise_id: exerciseBlock.exercise.id,
        sort_order: index,
        target_sets: exerciseBlock.sets.length,
        target_reps: firstSet?.reps ? String(firstSet.reps) : null,
        target_weight_kg: firstSet?.weight_kg ?? null,
        rest_seconds: firstSet?.rest_seconds ?? 90,
      };
    });

    const { error: rowError } = await supabase.from("template_exercises").insert(rows);

    if (rowError) {
      if (isMissingTableError(rowError)) {
        setDbFeaturesAvailable(false);
        toast.error("Template tables are missing in Supabase. Run migrations first.");
        return;
      }
      toast.error(rowError.message);
      return;
    }

    toast.success("Template saved.");
    await loadTemplates(userId);
  }

  // Rest timer handler for ExerciseCard
  const handleStartRest = useCallback(
    (exerciseId: string, exerciseName: string, seconds: number) => {
      const activeTimers = getActiveTimers();
      for (const timer of activeTimers) {
        stopTimer(timer.id);
      }
      startTimer(exerciseId, exerciseName, seconds);
    },
    [getActiveTimers, stopTimer, startTimer]
  );

  // Shared inner content for the lift picker
  const liftPickerExerciseList = (
    <>
      <Input
        value={liftSearch}
        onChange={(event) => setLiftSearch(event.target.value)}
        placeholder="Type to search lifts"
        className="mb-2"
        autoFocus
      />
      <ScrollArea className="h-96">
        <div className="space-y-2 pr-2">
          {loadingExercises ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Loading exercises...
            </p>
          ) : filteredExercises.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No lifts found for this filter.
            </p>
          ) : (
            filteredExercises.map((exercise) => {
              const mediaUrl = resolveExerciseMediaUrl(
                ("gif_url" in exercise && exercise.gif_url)
                  ? exercise.gif_url
                  : exercise.image_url,
                ("source" in exercise
                  ? (exercise as { source?: string | null }).source
                  : null) ?? null
              );
              return (
                <ExerciseSelectionCard
                  key={exercise.id}
                  exercise={exercise}
                  mediaUrl={mediaUrl}
                  posterUrl={resolveExerciseMediaUrl(
                    exercise.image_url,
                    ("source" in exercise
                      ? (exercise as { source?: string | null }).source
                      : null) ?? null
                  )}
                  selected={selectedExerciseId === exercise.id}
                  primaryBenefit={getPrimaryBenefit(exercise)}
                  coachingCues={getCoachingCues(exercise)}
                  previousPerformance={exerciseLastPerformance[exercise.id] ?? null}
                  onSelect={() => {
                    setSelectedExerciseId(exercise.id);
                  }}
                  onQuickAdd={async () => {
                    setSelectedExerciseId(exercise.id);
                    await addExerciseToWorkout(exercise);
                  }}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div data-phase="active" className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold tracking-tight">Workout</p>
          </div>
          {isWorkoutActive && activeWorkout ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              {plannerStats.completedSets}/{plannerStats.totalSets} sets
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-6 md:px-6 lg:px-10">
        {!isWorkoutActive ? (
          <PageHeader
            title="Workout"
            subtitle="Save templates, reuse them in future sessions, and compare to previous performance."
          />
        ) : null}

        {!isWorkoutActive ? (
          <Card className="mx-auto w-full max-w-3xl overflow-hidden border-primary/25 bg-card/95 shadow-xl transition-all duration-300">
            <div className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">New Session</p>
                  <p className="text-xl font-black tracking-tight">Start a Workout</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 p-5 sm:p-6">
              {!dbFeaturesAvailable ? (
                <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                  Supabase workout tables were not found. You can still add exercises and train now,
                  but templates/history sync will be limited until migrations are applied.
                </p>
              ) : null}

              <div className="rounded-xl border border-border/70 bg-secondary/20 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => { setSetupTab("templates"); setQuickFilter("All"); }}
                    className={`h-9 rounded-lg text-xs font-semibold transition ${setupTab === "templates"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/70"
                      }`}
                  >
                    My Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupTab("quick");
                      setSelectedTemplateId("none");
                      setPendingCategories([]);
                      setQuickFilter("All");
                    }}
                    className={`h-9 rounded-lg text-xs font-semibold transition ${setupTab === "quick"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/70"
                      }`}
                  >
                    Quick Start
                  </button>
                </div>
              </div>

              {setupTab === "templates" ? (
                <TemplateManagerPanel
                  templates={templates}
                  loadingTemplates={loadingTemplates}
                  selectedTemplateId={selectedTemplateId}
                  showTemplateManager={showTemplateManager}
                  templateActionBusyId={templateActionBusyId}
                  likedTemplateIds={likedTemplateIds}
                  onToggleManager={() => setShowTemplateManager((prev) => !prev)}
                  onSelectTemplate={(id, name) => {
                    setSelectedTemplateId(id);
                    setWorkoutName(name);
                    setPendingCategories([]);
                  }}
                  onSelectStartFresh={() => setSelectedTemplateId("none")}
                  onSendTemplate={handleSendTemplate}
                  onEditTemplate={handleEditTemplate}
                  onCopyTemplate={handleCopyTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onToggleLike={handleToggleTemplateLike}
                />
              ) : (
                <QuickStartPanel
                  presetId={presetId}
                  quickFilter={quickFilter}
                  onQuickFilterChange={setQuickFilter}
                  onPresetChange={handlePresetChange}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="workout-name" className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Session Name</Label>
                <Input
                  id="workout-name"
                  value={workoutName}
                  onChange={(event) => setWorkoutName(event.target.value)}
                  placeholder="Workout name"
                />
              </div>

              {/* Category picker -- required when a saved template has no workout type OR Start Fresh */}
              {setupTab === "templates" && (() => {
                if (selectedTemplateId !== "none") {
                  const tpl = templates.find((t) => t.id === selectedTemplateId);
                  if (tpl?.primary_muscle_group) return null;
                }
                const categoryOptions = MUSCLE_FILTERS.filter((f) => f !== "All");
                const isStartFresh = selectedTemplateId === "none";
                return (
                  <div className={`space-y-2 rounded-xl border p-3 ${isStartFresh
                    ? "border-border/70 bg-secondary/20"
                    : "border-amber-500/40 bg-amber-500/5"
                    }`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${isStartFresh ? "text-muted-foreground" : "text-amber-400"
                      }`}>
                      {isStartFresh ? "Workout Type" : "Workout Type Required"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isStartFresh
                        ? "Choose a category for your session."
                        : "Select a category to continue. This will be saved to your template."}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {categoryOptions.map((cat) => {
                        const lc = cat.toLowerCase();
                        const cgc = getMuscleColor(lc);
                        const active = pendingCategories.includes(lc);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              setPendingCategories((prev) =>
                                active ? prev.filter((c) => c !== lc) : [...prev, lc]
                              )
                            }
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-all"
                            style={active ? {
                              background: cgc.bgAlpha,
                              color: cgc.labelColor,
                              border: `1.5px solid ${cgc.borderAlpha}`,
                              boxShadow: `0 0 8px ${cgc.from}33`,
                            } : {
                              background: "transparent",
                              color: "var(--muted-foreground)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <Button
                className="h-11 w-full text-base font-semibold"
                onClick={handleStartWorkout}
                disabled={
                  ghostIsLoading ||
                  (setupTab === "templates" &&
                    pendingCategories.length === 0 &&
                    (selectedTemplateId === "none" ||
                      !templates.find((t) => t.id === selectedTemplateId)?.primary_muscle_group))
                }
              >
                {ghostIsLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Start Workout
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isWorkoutActive && activeWorkout ? (
          <>
            <WorkoutHeader
              workoutName={activeWorkout.name}
              startedAt={activeWorkout.started_at}
              totalVolumeDisplay={toDisplayVolume(plannerStats.totalVolumeKg).toLocaleString()}
              completedSets={plannerStats.completedSets}
              totalSets={plannerStats.totalSets}
              exerciseCount={plannerStats.exercises}
              completionProgressPct={completionProgressPct}
              unitLabel={unitLabel}
            />

            <div className="grid gap-6 lg:grid-cols-[21.25rem_minmax(0,1fr)]">
              <Card className="h-fit border-border/70 bg-card/95 shadow-sm transition-all duration-300 lg:sticky lg:top-20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={activeWorkout.name}
                      onChange={(e) => updateWorkoutName(e.target.value)}
                      className="h-9 flex-1 border-transparent bg-transparent px-0 text-[22px] font-semibold leading-tight tracking-tight focus:border-border focus:bg-background"
                      placeholder="Workout name"
                    />
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                      <Clock3 className="size-4" />
                      <ElapsedTime startedAt={activeWorkout.started_at} />
                    </span>
                  </div>
                  {activeWorkout.template_id ? (
                    <p className="text-xs text-muted-foreground">Template session</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Muscle groups</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {MUSCLE_GROUPS.filter((g) => g !== "full_body").map((group) => {
                          const isSelected = selectedMuscleGroup === group;
                          return (
                            <button
                              key={group}
                              type="button"
                              onClick={() => {
                                setSelectedMuscleGroup(group);
                                setSelectedExerciseId("");
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all",
                                isSelected
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : "border-border/60 bg-card/40 text-muted-foreground"
                              )}
                            >
                              {MUSCLE_GROUP_LABELS[group]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Available lifts</Label>
                      {isSmallScreen ? (
                        <Sheet open={liftPickerOpen} onOpenChange={setLiftPickerOpen}>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            onClick={() => setLiftPickerOpen(true)}
                          >
                            <span className="truncate">
                              {selectedExercise ? selectedExercise.name : "Search and choose a lift"}
                            </span>
                            <ChevronDown className="ml-2 size-4 shrink-0 opacity-70" />
                          </Button>
                          <SheetContent side="bottom" className="h-[72dvh] flex flex-col">
                            <SheetHeader>
                              <SheetTitle>Choose a lift</SheetTitle>
                            </SheetHeader>
                            <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
                              {liftPickerExerciseList}
                            </div>
                          </SheetContent>
                        </Sheet>
                      ) : (
                        <Popover open={liftPickerOpen} onOpenChange={setLiftPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              <span className="truncate">
                                {selectedExercise ? selectedExercise.name : "Search and choose a lift"}
                              </span>
                              <ChevronDown className="ml-2 size-4 shrink-0 opacity-70" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-2" align="start">
                            {liftPickerExerciseList}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>

                  {selectedExercise ? (
                    <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{selectedExercise.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {MUSCLE_GROUP_LABELS[selectedExercise.muscle_group as MuscleGroup] ?? selectedExercise.muscle_group}
                            {selectedExercise.equipment
                              ? ` \u00b7 ${EQUIPMENT_LABELS[selectedExercise.equipment] ?? selectedExercise.equipment}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="mt-3 w-full"
                        onClick={handleAddSelectedExercise}
                      >
                        <Plus className="mr-2 size-4" />
                        Add Selected Lift
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleAddSelectedExercise}
                      disabled
                    >
                      <Plus className="mr-2 size-4" />
                      Add Selected Lift
                    </Button>
                  )}

                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Create custom lift</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="custom-lift-name">Lift name</Label>
                        <Input
                          id="custom-lift-name"
                          value={customName}
                          onChange={(event) => setCustomName(event.target.value)}
                          placeholder="Ex: Cable Y Raise"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Muscle group</Label>
                          <Select
                            value={customMuscleGroup}
                            onValueChange={(value) => setCustomMuscleGroup(value as MuscleGroup)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select muscle group" />
                            </SelectTrigger>
                            <SelectContent>
                              {MUSCLE_GROUPS.map((group) => (
                                <SelectItem key={group} value={group}>
                                  {MUSCLE_GROUP_LABELS[group]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Equipment</Label>
                          <Select value={customEquipment} onValueChange={setCustomEquipment}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={handleCreateCustomExercise}
                      >
                        Create and Add Custom Lift
                      </Button>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[20px] font-bold tracking-tight">Exercises</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeWorkout.exercises.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-10 text-center">
                        <p className="text-[20px] font-semibold tracking-tight text-foreground">
                          Build the session that builds you.
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose your first exercise to enter training mode.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {ghostWorkoutData ? (
                          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                            Ghost workout active. You are training against your last matching session.
                          </div>
                        ) : null}
                        {activeWorkout.exercises.map((exerciseBlock, exerciseIndex) => (
                          <ExerciseCard
                            key={exerciseBlock.exercise.id}
                            exerciseBlock={exerciseBlock}
                            exerciseIndex={exerciseIndex}
                            ghostSets={ghostWorkoutData?.exercises[exerciseBlock.exercise.id]}
                            previousSets={previousByExerciseId[exerciseBlock.exercise.id]}
                            suggestedWeights={suggestedWeightsByKey[exerciseBlock.exercise.id]}
                            trendline={exerciseTrendlines[exerciseBlock.exercise.id]}
                            preference={preference}
                            onUpdateSet={updateSet}
                            onCompleteSet={completeSet}
                            onRemoveSet={removeSet}
                            onAddSet={addSet}
                            onRemoveExercise={removeExercise}
                            onSwapExercise={setSwapSheetIndex}
                            onSetExerciseNote={setExerciseNote}
                            onStartRest={handleStartRest}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/95 shadow-sm lg:sticky lg:top-20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Session Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Workout Notes */}
                    <div className="space-y-1.5 pb-3 border-b border-border/40">
                      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <NotebookPen className="h-3 w-3" />
                        Workout notes
                      </Label>
                      <Textarea
                        placeholder="How did the session feel? Any PRs or observations..."
                        value={activeWorkout.notes}
                        onChange={(e) => setWorkoutNote(e.target.value)}
                        className="min-h-[72px] resize-none text-sm"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleOpenSaveTemplate}
                      >
                        <Save className="mr-2 size-4" />
                        Save Template
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleCancelWorkout}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleFinishWorkout}
                      >
                        Finish Workout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}

        <SaveTemplateDialog
          open={saveTemplateDialogOpen}
          defaultName={activeWorkout?.name || ""}
          defaultCategories={(() => {
            if (!activeWorkout) return [];
            const groups = new Set<string>();
            for (const ex of activeWorkout.exercises) {
              if (ex.exercise.muscle_group) groups.add(ex.exercise.muscle_group);
            }
            return [...groups];
          })()}
          onClose={() => setSaveTemplateDialogOpen(false)}
          onSave={handleSaveTemplate}
        />

        <SendTemplateDialog
          open={sendDialogOpen}
          currentUserId={userId}
          template={sendingTemplate}
          onClose={() => {
            setSendDialogOpen(false);
            setSendingTemplate(null);
          }}
          onSend={async (recipientId, template, message) => {
            await sendTemplate(recipientId, template, message);
            toast.success("Template sent to shared mailbox");
          }}
        />

        {/* Workout Complete Celebration */}
        {showCelebration && celebrationStats && (
          <WorkoutCompleteCelebration
            stats={celebrationStats}
            confettiStyle="gold"
            onClose={handleCloseWorkoutCelebration}
          />
        )}

        {/* Level-Up Celebration -- shown after workout celebration closes */}
        {!showCelebration && levelUpData && (
          <LevelUpCelebration
            newLevel={levelUpData.newLevel}
            onClose={handleCloseLevelUp}
          />
        )}

        {/* Session RPE Prompt */}
        <WorkoutCompletionDialog
          open={sessionRpePromptOpen}
          onOpenChange={setSessionRpePromptOpen}
          sessionRpeValue={sessionRpeValue}
          onSessionRpeChange={setSessionRpeValue}
          onSave={handleSaveSessionRpe}
          saving={savingSessionRpe}
        />

        {/* Floating Rest Timer Pill */}
        <RestTimerPill />

        {/* AI Coach Voice Command Bar */}
        {AI_COACH_ENABLED && isWorkoutActive && <VoiceCommandBar />}

        {/* Exercise Swap Sheet */}
        <ExerciseSwapSheet
          open={swapSheetIndex !== null}
          exerciseIndex={swapSheetIndex}
          currentExercise={
            swapSheetIndex !== null
              ? (activeWorkout?.exercises[swapSheetIndex]?.exercise ?? null)
              : null
          }
          onSwap={handleSwapExercise}
          onClose={() => setSwapSheetIndex(null)}
        />
      </div>
    </div>
  );
}
```

---
## FILE: src/app/(app)/nutrition/page.tsx
```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Settings2,
  Plus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Apple,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Share2,
  BookmarkPlus,
} from "lucide-react";
import { addDays, subDays, format } from "date-fns";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { useSharedItems } from "@/hooks/use-shared-items";
import {
  trackNutritionCatchupCompleted,
  trackNutritionCatchupNudgeShown,
} from "@/lib/retention-events";
import { FoodLogCard } from "@/components/nutrition/food-log-card";
import { MealTemplateSheet } from "@/components/nutrition/meal-template-sheet";
import { Camera, Utensils, ShoppingCart } from "lucide-react";
import { MENU_SCANNER_ENABLED, FOOD_SCANNER_ENABLED, GROCERY_GENERATOR_ENABLED } from "@/lib/features";
import { SendMealDialog } from "@/components/social/send-meal-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { MacroRing } from "@/components/ui/macro-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { FoodItem, MealType, MealTemplateItem } from "@/types/nutrition";

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: MealType;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

type EntryNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
};

const mealConfig: Record<MealType, { label: string; Icon: React.ElementType; color: string }> = {
  breakfast: {
    label: "Breakfast",
    Icon: Coffee,
    color: "text-amber-400",
  },
  lunch: {
    label: "Lunch",
    Icon: Sun,
    color: "text-yellow-400",
  },
  dinner: {
    label: "Dinner",
    Icon: Moon,
    color: "text-blue-400",
  },
  snack: {
    label: "Snacks",
    Icon: Cookie,
    color: "text-pink-400",
  },
};

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

function getEntryNutrition(entry: FoodLogEntry): EntryNutrition {
  const servings = entry.servings ?? 1;
  const item = entry.food_items;

  return {
    calories:
      item?.calories_per_serving != null
        ? roundTo2(item.calories_per_serving * servings)
        : entry.calories_consumed ?? 0,
    protein:
      item?.protein_g != null
        ? roundTo2(item.protein_g * servings)
        : entry.protein_g ?? 0,
    carbs:
      item?.carbs_g != null
        ? roundTo2(item.carbs_g * servings)
        : entry.carbs_g ?? 0,
    fat:
      item?.fat_g != null
        ? roundTo2(item.fat_g * servings)
        : entry.fat_g ?? 0,
    fiber:
      item?.fiber_g != null ? roundTo2(item.fiber_g * servings) : 0,
    sugar:
      item?.sugar_g != null ? roundTo2(item.sugar_g * servings) : 0,
    sodiumMg:
      item?.sodium_mg != null ? roundTo2(item.sodium_mg * servings) : 0,
  };
}

function MacroChip({
  label,
  value,
  goal,
  unit = "g",
  colorClass,
}: {
  label: string;
  value: number;
  goal?: number | null;
  unit?: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 sm:gap-1 sm:rounded-xl sm:px-3 sm:py-2">
      <span className={`text-[10px] font-semibold uppercase tracking-wider sm:text-xs ${colorClass}`}>{label}</span>
      <span className="text-sm font-bold text-foreground sm:text-base">
        {Math.round(value)}
        <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">{unit}</span>
      </span>
      {goal != null && goal > 0 ? (
        <span className="text-[9px] text-muted-foreground sm:text-[10px]">
          / {Math.round(goal)}
          {unit}
        </span>
      ) : null}
    </div>
  );
}

function MealSection({
  meal,
  entries,
  getNutrition,
  onDelete,
  onEdit,
}: {
  meal: MealType;
  entries: FoodLogEntry[];
  getNutrition: (entry: FoodLogEntry) => EntryNutrition;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}) {
  const { label, Icon, color } = mealConfig[meal];
  const mealCalories = entries.reduce((sum, e) => sum + getNutrition(e).calories, 0);

  return (
    <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Icon className={`size-4 ${color}`} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            {entries.length > 0 ? (
              <p className="text-xs text-muted-foreground">{Math.round(mealCalories)} kcal</p>
            ) : null}
          </div>
        </div>
        <Link href={`/nutrition/scan?meal=${meal}`}>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
            <Plus className="size-3.5" />
            Add
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nothing logged yet</p>
        ) : (
          entries.map((entry) => (
            <FoodLogCard key={entry.id} entry={entry} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

type GoalData = {
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  fiber_g_target?: number | null;
};

export default function NutritionPage() {
  const supabase = useSupabase();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [goals, setGoals] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sendMealDialogOpen, setSendMealDialogOpen] = useState(false);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);

  const { sendMealDay } = useSharedItems(currentUserId);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;
        setCurrentUserId(user.id);

        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const localDayStart = new Date(selectedDate);
        localDayStart.setHours(0, 0, 0, 0);
        const localNextDayStart = new Date(localDayStart);
        localNextDayStart.setDate(localNextDayStart.getDate() + 1);

        const { data: rawEntries } = await supabase
          .from("food_log")
          .select(
            "id, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g, logged_at, food_items(id, name, brand, barcode, source, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_description, serving_size_g)"
          )
          .eq("user_id", user.id)
          .gte("logged_at", localDayStart.toISOString())
          .lt("logged_at", localNextDayStart.toISOString())
          .order("logged_at", { ascending: true });

        setEntries((rawEntries ?? []) as unknown as FoodLogEntry[]);

        const { data: goalsData } = await supabase
          .from("nutrition_goals")
          .select("*")
          .eq("user_id", user.id)
          .lte("effective_from", dateStr)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle();

        setGoals((goalsData ?? null) as GoalData | null);
      } catch (err) {
        console.error("Failed to load nutrition data:", err);
        toast.error("Failed to load nutrition data");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [selectedDate, supabase]);

  async function handleDelete(entryId: string) {
    const previousEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    try {
      const { error } = await supabase.from("food_log").delete().eq("id", entryId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to delete entry");
    }
  }

  async function handleEdit(entryId: string, updates: { meal_type: string; servings: number }) {
    const previousEntries = entries;
    const current = previousEntries.find((entry) => entry.id === entryId) ?? null;
    if (!current) return;

    const nextNutrition = getEntryNutrition({ ...current, servings: updates.servings });

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              meal_type: updates.meal_type as MealType,
              servings: updates.servings,
              calories_consumed: nextNutrition.calories,
              protein_g: nextNutrition.protein,
              carbs_g: nextNutrition.carbs,
              fat_g: nextNutrition.fat,
            }
          : e
      )
    );

    try {
      const { error } = await supabase
        .from("food_log")
        .update({
          meal_type: updates.meal_type,
          servings: updates.servings,
          calories_consumed: nextNutrition.calories,
          protein_g: nextNutrition.protein,
          carbs_g: nextNutrition.carbs,
          fat_g: nextNutrition.fat,
        })
        .eq("id", entryId);

      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to update entry");
      throw err;
    }
  }

  const displayDate = format(selectedDate, "EEEE, MMMM d");

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const nutrition = getEntryNutrition(entry);
        acc.calories += nutrition.calories;
        acc.protein += nutrition.protein;
        acc.carbs += nutrition.carbs;
        acc.fat += nutrition.fat;
        acc.fiber += nutrition.fiber;
        acc.sugar += nutrition.sugar;
        acc.sodiumMg += nutrition.sodiumMg;
        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodiumMg: 0,
      }
    );
  }, [entries]);

  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const totalCarbs = totals.carbs;
  const totalFat = totals.fat;
  const totalFiber = totals.fiber;
  const totalSugar = totals.sugar;
  const totalSodiumMg = totals.sodiumMg;

  const mealGroups: Record<MealType, FoodLogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const entry of entries) {
    if (entry.meal_type in mealGroups) {
      mealGroups[entry.meal_type].push(entry);
    }
  }

  const calorieGoal = goals?.calories_target ?? null;
  const calorieProgress =
    calorieGoal != null && calorieGoal > 0
      ? Math.min((totalCalories / calorieGoal) * 100, 100)
      : null;
  const caloriesRemaining = calorieGoal != null ? calorieGoal - totalCalories : null;
  const isOver = caloriesRemaining != null && caloriesRemaining < 0;
  const proteinGoal = goals?.protein_g_target ?? null;
  const proteinRemaining = proteinGoal != null ? Math.max(0, proteinGoal - totalProtein) : null;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const hoursElapsed = Math.max(1, now.getHours() + now.getMinutes() / 60);
  const projectedProteinBy9pm =
    isToday && totalProtein > 0
      ? Math.round((totalProtein / hoursElapsed) * 21)
      : Math.round(totalProtein);
  const catchupNeeded = isToday && (proteinRemaining ?? 0) >= 20;

  useEffect(() => {
    if (!currentUserId || !catchupNeeded) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_nudge_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupNudgeShown(supabase, currentUserId, {
      date: dayKey,
      protein_remaining_g: Math.round(proteinRemaining ?? 0),
      protein_goal_g: proteinGoal,
      calories_so_far: Math.round(totalCalories),
    });
  }, [
    catchupNeeded,
    currentUserId,
    proteinRemaining,
    proteinGoal,
    selectedDate,
    supabase,
    totalCalories,
  ]);

  useEffect(() => {
    if (!currentUserId || !isToday || proteinGoal == null || proteinGoal <= 0) return;
    if (totalProtein < proteinGoal) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_completed:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupCompleted(supabase, currentUserId, {
      date: dayKey,
      protein_goal_g: proteinGoal,
      protein_logged_g: Math.round(totalProtein),
      calories_logged: Math.round(totalCalories),
    });
  }, [currentUserId, isToday, proteinGoal, selectedDate, supabase, totalCalories, totalProtein]);

  const handleLoadTemplate = async (items: MealTemplateItem[]) => {
    if (!currentUserId) return;
    const now = new Date();
    try {
      for (const item of items) {
        const { error } = await supabase.from("food_log").insert({
          user_id: currentUserId,
          food_item_id: item.food_item_id,
          meal_type: "snack",
          servings: item.servings,
          calories_consumed: item.calories * item.servings,
          protein_g: item.protein_g != null ? item.protein_g * item.servings : null,
          carbs_g: item.carbs_g != null ? item.carbs_g * item.servings : null,
          fat_g: item.fat_g != null ? item.fat_g * item.servings : null,
          logged_at: now.toISOString(),
        });
        if (error) throw error;
      }
      // Re-fetch entries to show the newly added items
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const localDayStart = new Date(selectedDate);
      localDayStart.setHours(0, 0, 0, 0);
      const localNextDayStart = new Date(localDayStart);
      localNextDayStart.setDate(localNextDayStart.getDate() + 1);

      const { data: rawEntries } = await supabase
        .from("food_log")
        .select(
          "id, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g, logged_at, food_items(id, name, brand, barcode, source, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_description, serving_size_g)"
        )
        .eq("user_id", currentUserId)
        .gte("logged_at", localDayStart.toISOString())
        .lt("logged_at", localNextDayStart.toISOString())
        .order("logged_at", { ascending: true });

      setEntries((rawEntries ?? []) as unknown as FoodLogEntry[]);
    } catch (err) {
      console.error("Failed to load template items:", err);
      toast.error("Failed to add template items to log");
    }
  };

  const mealEntryToSnapshot = (entry: FoodLogEntry) => {
    const nutrition = getEntryNutrition(entry);
    return {
      name: entry.food_items?.name ?? entry.food_name ?? "Unknown",
      brand: entry.food_items?.brand ?? entry.food_brand ?? null,
      servings: entry.servings,
      calories: nutrition.calories,
      protein_g: nutrition.protein,
      carbs_g: nutrition.carbs,
      fat_g: nutrition.fat,
    };
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-4 md:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl glass-surface-elevated glass-highlight p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-36 w-36 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="relative space-y-4">
          <PageHeader
            eyebrow={displayDate}
            title="Nutrition"
            actions={
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setMealSheetOpen(true)}
                  title="Saved Meals"
                >
                  <BookmarkPlus className="size-4" />
                  <span className="sr-only">Saved Meals</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setSendMealDialogOpen(true)}
                  disabled={entries.length === 0}
                  title="Share today's meals"
                >
                  <Share2 className="size-4" />
                  <span className="sr-only">Share Day</span>
                </Button>
                <Link href="/nutrition/scan">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Barcode className="size-4" />
                    <span className="hidden sm:inline">Scan</span>
                  </Button>
                </Link>
                <Link href="/nutrition/goals">
                  <Button size="icon" variant="ghost" className="size-9">
                    <Settings2 className="size-4" />
                    <span className="sr-only">Nutrition Goals</span>
                  </Button>
                </Link>
              </>
            }
          />

          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-2 py-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="text-sm font-medium"
              >
                {format(selectedDate, "MMM d, yyyy") === format(new Date(), "MMM d, yyyy")
                  ? "Today"
                  : format(selectedDate, "MMM d, yyyy")}
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
              disabled={format(selectedDate, "yyyy-MM-dd") >= format(new Date(), "yyyy-MM-dd")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border-border/70 bg-card/85">
              <CardContent className="pt-5 pb-4">
                {isToday ? (
                  <div className="mb-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Fuel Readiness
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {proteinGoal
                        ? `Projected by 9PM: ${projectedProteinBy9pm}g protein`
                        : "Set a protein goal to activate predictive fueling guidance."}
                    </p>
                  </div>
                ) : null}

                {calorieGoal != null ? (
                  <>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Calories consumed</p>
                        <p className="text-2xl font-bold text-foreground sm:text-4xl">
                          {Math.round(totalCalories)}
                          <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">
                            / {calorieGoal} kcal
                          </span>
                        </p>
                      </div>
                      <Badge variant={isOver ? "destructive" : "secondary"} className="w-fit rounded-full px-2.5 text-xs">
                        {isOver
                          ? `${Math.abs(Math.round(caloriesRemaining!))} over`
                          : `${Math.round(caloriesRemaining!)} left`}
                      </Badge>
                    </div>
                    <Progress
                      value={calorieProgress ?? 0}
                      className={`h-3 ${isOver ? "[&>div]:bg-destructive" : ""}`}
                    />
                  </>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Calories consumed</p>
                      <p className="text-2xl font-bold text-foreground sm:text-4xl">
                        {Math.round(totalCalories)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">kcal</span>
                      </p>
                    </div>
                    <Link href="/nutrition/goals">
                      <Button size="sm" variant="outline" className="w-fit gap-1.5 text-xs">
                        <Apple className="size-3.5" />
                        Set Goals
                      </Button>
                    </Link>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MacroChip label="Protein" value={totalProtein} goal={goals?.protein_g_target} colorClass={MACRO_COLORS.protein} />
                  <MacroChip label="Carbs" value={totalCarbs} goal={goals?.carbs_g_target} colorClass={MACRO_COLORS.carbs} />
                  <MacroChip label="Fat" value={totalFat} goal={goals?.fat_g_target} colorClass={MACRO_COLORS.fat} />
                  <MacroChip label="Fiber" value={totalFiber} goal={goals?.fiber_g_target} colorClass={MACRO_COLORS.fiber} />
                  <MacroChip label="Sugar" value={totalSugar} colorClass="text-rose-400" />
                  <MacroChip label="Sodium" value={totalSodiumMg} unit="mg" colorClass="text-cyan-400" />
                </div>

                {catchupNeeded ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Protein Catch-Up</p>
                      <p className="text-sm font-medium text-foreground">
                        Need {Math.round(proteinRemaining ?? 0)}g more to hit today&apos;s target.
                      </p>
                    </div>
                    <Link href="/nutrition/scan">
                      <Button size="sm" className="motion-press h-8 rounded-lg px-3 text-xs">
                        Add Protein
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Macro Rings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="calories" value={totalCalories} target={goals?.calories_target ?? 0} label="Calories" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="protein" value={totalProtein} target={goals?.protein_g_target ?? 0} label="Protein" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="carbs" value={totalCarbs} target={goals?.carbs_g_target ?? 0} label="Carbs" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="fat" value={totalFat} target={goals?.fat_g_target ?? 0} label="Fat" /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {(MENU_SCANNER_ENABLED || FOOD_SCANNER_ENABLED || GROCERY_GENERATOR_ENABLED) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MENU_SCANNER_ENABLED && (
            <Link href="/nutrition/menu-scan">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Camera className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Menu Scan</p>
                    <p className="text-xs text-muted-foreground">Scan a restaurant menu</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {FOOD_SCANNER_ENABLED && (
            <Link href="/nutrition/food-scan">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Utensils className="size-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Food Scan</p>
                    <p className="text-xs text-muted-foreground">Photograph your plate</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {GROCERY_GENERATOR_ENABLED && (
            <Link href="/nutrition/grocery">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                    <ShoppingCart className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Grocery List</p>
                    <p className="text-xs text-muted-foreground">Generate a smart grocery list</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Meals</h2>
          <p className="text-xs text-muted-foreground">Organized by meal windows</p>
        </div>

        {loading ? (
          <Card className="border-border/70 bg-card/85">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading nutrition data...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={mealGroups[meal]}
                getNutrition={getEntryNutrition}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>

      <MealTemplateSheet
        open={mealSheetOpen}
        onOpenChange={setMealSheetOpen}
        currentEntries={entries}
        onLoadTemplate={handleLoadTemplate}
      />

      <SendMealDialog
        open={sendMealDialogOpen}
        currentUserId={currentUserId}
        snapshot={
          entries.length > 0
            ? {
                date: format(selectedDate, "yyyy-MM-dd"),
                totals: {
                  calories: totalCalories,
                  protein_g: totalProtein,
                  carbs_g: totalCarbs,
                  fat_g: totalFat,
                  fiber_g: totalFiber,
                  sugar_g: totalSugar,
                  sodium_mg: totalSodiumMg,
                },
                meals: {
                  breakfast: mealGroups.breakfast.map(mealEntryToSnapshot),
                  lunch: mealGroups.lunch.map(mealEntryToSnapshot),
                  dinner: mealGroups.dinner.map(mealEntryToSnapshot),
                  snack: mealGroups.snack.map(mealEntryToSnapshot),
                },
              }
            : null
        }
        onClose={() => setSendMealDialogOpen(false)}
        onSend={sendMealDay}
      />
    </div>
  );
}
```

---
## FILE: src/app/(app)/nutrition/food-scan/page.tsx
```tsx
import { redirect } from "next/navigation";
import { FOOD_SCANNER_ENABLED } from "@/lib/features";
import { FoodScanner } from "@/components/nutrition/food-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FoodScanPage() {
  if (!FOOD_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Food Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Take a photo of your meal and we&apos;ll estimate the macros for each item. You can review and adjust before logging.
      </p>

      <FoodScanner />
    </div>
  );
}
```

---
## FILE: src/app/(app)/nutrition/menu-scan/page.tsx
```tsx
import { redirect } from "next/navigation";
import { MENU_SCANNER_ENABLED } from "@/lib/features";
import { MenuScanner } from "@/components/nutrition/menu-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MenuScanPage() {
  if (!MENU_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Menu Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Snap a photo of a restaurant menu and get personalized meal recommendations based on your remaining macros.
      </p>

      <MenuScanner />
    </div>
  );
}
```

---
## FILE: src/app/(app)/nutrition/grocery/page.tsx
```tsx
import { redirect } from "next/navigation";
import { GROCERY_GENERATOR_ENABLED } from "@/lib/features";
import { GroceryListBoard } from "@/components/nutrition/grocery-list-board";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GroceryPage() {
  if (!GROCERY_GENERATOR_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Grocery List</h1>
      </div>

      <GroceryListBoard />
    </div>
  );
}
```

---
## FILE: src/app/(app)/body/page.tsx
```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { format, parseISO, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { weightToDisplay, lbsToKg, lengthToDisplay, inchesToCm, lengthUnit } from "@/lib/units";
import {
  Scale,
  Ruler,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightLog = {
  id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
};

type MeasurementLog = {
  id: string;
  measured_date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  note: string | null;
};

type RangeOption = "30d" | "90d" | "1y" | "all";
type BodyTab = "weight" | "measurements";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kgToDisplay(kg: number, isImperial: boolean) {
  return weightToDisplay(kg, isImperial, 1);
}

function displayToKg(val: number, isImperial: boolean) {
  return isImperial ? lbsToKg(val) : val;
}

function displayToCm(val: number, isImperial: boolean) {
  return isImperial ? inchesToCm(val) : val;
}

const WeightChart = dynamic(() => import("@/components/charts/weight-chart"), {
  loading: () => <Skeleton className="h-[180px] w-full rounded-xl" />,
  ssr: false,
});

const MeasurementsChart = dynamic(
  () =>
    import("@/components/charts/measurements-chart").then((m) => ({
      default: m.MeasurementsChart,
    })),
  {
    loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
    ssr: false,
  }
);

// ─── Measurement fields config ────────────────────────────────────────────────

const MEASUREMENT_FIELDS: {
  key: keyof Pick<
    MeasurementLog,
    | "waist_cm"
    | "chest_cm"
    | "hips_cm"
    | "left_arm_cm"
    | "right_arm_cm"
    | "left_thigh_cm"
    | "right_thigh_cm"
  >;
  label: string;
  placeholder: string;
}[] = [
  { key: "waist_cm", label: "Waist", placeholder: "32.0" },
  { key: "chest_cm", label: "Chest", placeholder: "40.0" },
  { key: "hips_cm", label: "Hips", placeholder: "38.0" },
  { key: "left_arm_cm", label: "Left Arm", placeholder: "14.0" },
  { key: "right_arm_cm", label: "Right Arm", placeholder: "14.0" },
  { key: "left_thigh_cm", label: "Left Thigh", placeholder: "24.0" },
  { key: "right_thigh_cm", label: "Right Thigh", placeholder: "24.0" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BodyMetricsPage() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const measUnit = lengthUnit(isImperial);

  const [activeTab, setActiveTab] = useState<BodyTab>("weight");

  // ── Weight state ──
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>("90d");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Weight form state
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formWeight, setFormWeight] = useState("");
  const [formBf, setFormBf] = useState("");
  const [formNote, setFormNote] = useState("");

  // ── Measurements state ──
  const [measurements, setMeasurements] = useState<MeasurementLog[]>([]);
  const [measLoading, setMeasLoading] = useState(false);
  const [measShowForm, setMeasShowForm] = useState(false);
  const [measSubmitting, setMeasSubmitting] = useState(false);
  const [measEditingId, setMeasEditingId] = useState<string | null>(null);
  const [measFormError, setMeasFormError] = useState<string | null>(null);
  const [measFormDate, setMeasFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [measFormNote, setMeasFormNote] = useState("");
  const [measFormValues, setMeasFormValues] = useState<Record<string, string>>({});
  const measHasFetched = useRef(false);

  // ── Weight logic ──

  const resetForm = useCallback(() => {
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormWeight("");
    setFormBf("");
    setFormNote("");
    setFormError(null);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=365");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLogs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Filter by range
  const filteredLogs = (() => {
    if (range === "all") return [...logs];
    const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const cutoff = subDays(new Date(), days).toISOString().slice(0, 10);
    return logs.filter((l) => l.logged_date >= cutoff);
  })();

  // Chart data (chronological)
  const chartData = [...filteredLogs]
    .reverse()
    .map((l) => ({
      date: format(parseISO(l.logged_date), "MMM d"),
      weight_kg: l.weight_kg,
    }));

  const timelineLogs = [...filteredLogs].slice(0, 12).reverse();
  const timelineWeights = timelineLogs.map((l) => kgToDisplay(l.weight_kg, isImperial));
  const timelineMin = timelineWeights.length ? Math.min(...timelineWeights) : 0;
  const timelineMax = timelineWeights.length ? Math.max(...timelineWeights) : 0;
  const timelineSpread = timelineMax - timelineMin;
  const timelineStart = timelineLogs[0];
  const timelineCurrent = timelineLogs[timelineLogs.length - 1];
  const timelineChange =
    timelineStart && timelineCurrent
      ? kgToDisplay(timelineCurrent.weight_kg, isImperial) -
        kgToDisplay(timelineStart.weight_kg, isImperial)
      : null;

  // Stats
  const latest = logs[0];
  const oldest = filteredLogs[filteredLogs.length - 1];
  const delta =
    latest && oldest && latest.id !== oldest.id
      ? kgToDisplay(latest.weight_kg, isImperial) - kgToDisplay(oldest.weight_kg, isImperial)
      : null;

  const handleSave = async () => {
    setFormError(null);
    const wVal = parseFloat(formWeight);
    if (!formWeight || Number.isNaN(wVal) || wVal <= 0) {
      setFormError("Enter a valid weight greater than 0.");
      return;
    }

    const bodyFat = formBf.trim() ? parseFloat(formBf) : null;
    if (
      bodyFat != null &&
      (Number.isNaN(bodyFat) || bodyFat < 0 || bodyFat > 100)
    ) {
      setFormError("Body fat must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    const weight_kg = displayToKg(wVal, isImperial);
    const body_fat_pct = bodyFat;
    const payload = {
      logged_date: formDate,
      weight_kg,
      body_fat_pct,
      note: formNote.trim() || null,
    };

    const res = await fetch("/api/body/weight", {
      method: editingLogId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingLogId ? { id: editingLogId, ...payload } : payload),
    });

    if (res.ok) {
      resetForm();
      setEditingLogId(null);
      setShowForm(false);
      await fetchLogs();
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setFormError(err?.error ?? "Failed to save body metric entry.");
    }
    setSubmitting(false);
  };

  const handleEdit = (log: WeightLog) => {
    setEditingLogId(log.id);
    setFormDate(log.logged_date);
    setFormWeight(String(kgToDisplay(log.weight_kg, isImperial)));
    setFormBf(log.body_fat_pct != null ? String(log.body_fat_pct) : "");
    setFormNote(log.note ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/body/weight?id=${id}`, { method: "DELETE" });
    if (editingLogId === id) {
      handleCancelEdit();
      setShowForm(false);
    }
    await fetchLogs();
  };

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setEditingLogId(null);
      setFormError(null);
      return;
    }
    setEditingLogId(null);
    resetForm();
    setShowForm(true);
  };

  const TrendIcon =
    delta === null ? Minus : delta < 0 ? TrendingDown : TrendingUp;
  const trendColor =
    delta === null
      ? "text-muted-foreground"
      : delta < 0
      ? "text-emerald-400"
      : "text-rose-400";

  const RANGES: { label: string; value: RangeOption }[] = [
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "1Y", value: "1y" },
    { label: "All", value: "all" },
  ];

  // ── Measurements logic ──

  const resetMeasForm = useCallback(() => {
    setMeasFormDate(format(new Date(), "yyyy-MM-dd"));
    setMeasFormNote("");
    setMeasFormValues({});
    setMeasFormError(null);
  }, []);

  const fetchMeasurements = useCallback(async () => {
    setMeasLoading(true);
    try {
      const res = await fetch("/api/body/measurements?limit=365");
      if (res.ok) {
        const data = (await res.json()) as MeasurementLog[];
        setMeasurements(data);
      }
    } catch {
      toast.error("Failed to load measurements");
    } finally {
      setMeasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "measurements" && !measHasFetched.current) {
      measHasFetched.current = true;
      void fetchMeasurements();
    }
  }, [activeTab, fetchMeasurements]);

  const handleMeasSave = async () => {
    setMeasFormError(null);

    // Validate at least one field has a value
    const filledFields = MEASUREMENT_FIELDS.filter((f) => {
      const v = measFormValues[f.key]?.trim();
      return v && !Number.isNaN(parseFloat(v)) && parseFloat(v) > 0;
    });

    if (filledFields.length === 0) {
      setMeasFormError("Enter at least one measurement.");
      return;
    }

    setMeasSubmitting(true);

    const payload: Record<string, unknown> = {
      measured_date: measFormDate,
      note: measFormNote.trim() || null,
    };

    for (const f of MEASUREMENT_FIELDS) {
      const raw = measFormValues[f.key]?.trim();
      if (raw && !Number.isNaN(parseFloat(raw)) && parseFloat(raw) > 0) {
        payload[f.key] = displayToCm(parseFloat(raw), isImperial);
      } else {
        payload[f.key] = null;
      }
    }

    try {
      const res = await fetch("/api/body/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          measEditingId ? { id: measEditingId, ...payload } : payload
        ),
      });

      if (res.ok) {
        resetMeasForm();
        setMeasEditingId(null);
        setMeasShowForm(false);
        await fetchMeasurements();
        toast.success(measEditingId ? "Measurement updated" : "Measurement saved");
      } else {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMeasFormError(err?.error ?? "Failed to save measurement.");
      }
    } catch {
      setMeasFormError("Failed to save measurement.");
    }
    setMeasSubmitting(false);
  };

  const handleMeasEdit = (log: MeasurementLog) => {
    setMeasEditingId(log.id);
    setMeasFormDate(log.measured_date);
    setMeasFormNote(log.note ?? "");
    const vals: Record<string, string> = {};
    for (const f of MEASUREMENT_FIELDS) {
      const v = log[f.key];
      if (v != null) {
        vals[f.key] = String(lengthToDisplay(v, isImperial, 1));
      }
    }
    setMeasFormValues(vals);
    setMeasFormError(null);
    setMeasShowForm(true);
  };

  const handleMeasDelete = async (id: string) => {
    try {
      await fetch(`/api/body/measurements?id=${id}`, { method: "DELETE" });
      if (measEditingId === id) {
        setMeasEditingId(null);
        resetMeasForm();
        setMeasShowForm(false);
      }
      await fetchMeasurements();
      toast.success("Measurement deleted");
    } catch {
      toast.error("Failed to delete measurement");
    }
  };

  const toggleMeasForm = () => {
    if (measShowForm) {
      setMeasShowForm(false);
      setMeasEditingId(null);
      setMeasFormError(null);
      return;
    }
    setMeasEditingId(null);
    resetMeasForm();
    setMeasShowForm(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-6">
      <PageHeader title="Body Metrics" />

      {/* ── Tab Switcher ──────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {(
          [
            { value: "weight", label: "Weight", Icon: Scale },
            { value: "measurements", label: "Measurements", Icon: Ruler },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold transition-colors",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            <tab.Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  WEIGHT TAB                                                 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "weight" && (
        <>
          {/* ── Hero Stats ─────────────────────────────────────────────── */}
          <div className="rounded-3xl glass-surface-elevated glass-highlight p-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : latest ? (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Current Weight
                  </p>
                  <p className="text-[40px] font-black leading-none tabular-nums">
                    {kgToDisplay(latest.weight_kg, isImperial)}
                    <span className="ml-1.5 text-[18px] font-bold text-muted-foreground">
                      {unitLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(parseISO(latest.logged_date), "MMMM d, yyyy")}
                  </p>
                </div>
                {delta !== null && (
                  <div className={cn("flex items-center gap-1 text-sm font-semibold", trendColor)}>
                    <TrendIcon className="h-4 w-4" />
                    <span>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)} {unitLabel}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No weight logged yet. Add your first entry below.
              </div>
            )}
          </div>

          {/* ── Chart ──────────────────────────────────────────────────── */}
          {!loading && logs.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold text-foreground">Weight History</p>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRange(r.value)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                        range === r.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.length > 0 ? (
                <>
                  <WeightChart chartData={chartData} isImperial={isImperial} />
                  {chartData.length === 1 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Add one more entry to unlock a full trend line.
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[12px] text-muted-foreground">
                    No entries in this range.
                  </p>
                  <Button
                    onClick={() => setRange("all")}
                    variant="outline"
                    size="xs"
                    className="mt-2"
                  >
                    Show All
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Timeline Ribbon ────────────────────────────────────────── */}
          {!loading && timelineLogs.length > 1 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Body Trend Ribbon</p>
                  <p className="text-[10px] text-muted-foreground">
                    Last {timelineLogs.length} entries in this view
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Range {timelineMin.toFixed(1)}-{timelineMax.toFixed(1)} {unitLabel}
                </p>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
                  <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                    {timelineStart ? `${kgToDisplay(timelineStart.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</p>
                  <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                    {timelineCurrent ? `${kgToDisplay(timelineCurrent.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Change</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12px] font-semibold tabular-nums",
                      timelineChange == null
                        ? "text-muted-foreground"
                        : timelineChange < 0
                          ? "text-emerald-400"
                          : timelineChange > 0
                            ? "text-rose-400"
                            : "text-muted-foreground"
                    )}
                  >
                    {timelineChange == null
                      ? "--"
                      : `${timelineChange > 0 ? "+" : ""}${timelineChange.toFixed(1)} ${unitLabel}`}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {timelineLogs.map((log, idx) => {
                  const displayWeight = kgToDisplay(log.weight_kg, isImperial);
                  const prevWeight =
                    idx > 0
                      ? kgToDisplay(timelineLogs[idx - 1].weight_kg, isImperial)
                      : null;
                  const stepDelta =
                    prevWeight != null ? displayWeight - prevWeight : null;
                  const rawPct =
                    timelineSpread <= 0
                      ? 100
                      : ((displayWeight - timelineMin) / timelineSpread) * 100;
                  const pct = Math.max(8, Math.min(100, rawPct));
                  const barColor =
                    stepDelta == null
                      ? "bg-primary"
                      : stepDelta < 0
                        ? "bg-emerald-400"
                        : stepDelta > 0
                          ? "bg-rose-400"
                          : "bg-primary";

                  return (
                    <div
                      key={log.id}
                      className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(log.logged_date), "MMM d")}
                      </p>
                      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/40">
                        <motion.div
                          className={cn("h-full rounded-full", barColor)}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.35 }}
                        />
                        <div className="absolute inset-y-0 right-0 w-px bg-border/60" />
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold tabular-nums text-foreground">
                          {displayWeight.toFixed(1)}
                        </p>
                        {stepDelta != null && (
                          <p
                            className={cn(
                              "text-[9px] tabular-nums",
                              stepDelta < 0
                                ? "text-emerald-400"
                                : stepDelta > 0
                                  ? "text-rose-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {stepDelta > 0 ? "+" : ""}
                            {stepDelta.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Log Form ───────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
            <button
              onClick={toggleForm}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  {editingLogId ? (
                    <Pencil className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="text-[13px] font-bold">
                  {editingLogId ? "Edit Entry" : "Log Weight"}
                </span>
              </div>
              <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {showForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
                    {editingLogId && (
                      <p className="text-[11px] font-medium text-primary">
                        Editing an existing body metric entry
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Date</Label>
                        <Input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Weight ({unitLabel})</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          placeholder={unitLabel === "kg" ? "75.0" : "165.0"}
                          value={formWeight}
                          onChange={(e) => setFormWeight(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Body Fat % (optional)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="18.5"
                          value={formBf}
                          onChange={(e) => setFormBf(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Note (optional)</Label>
                        <Input
                          placeholder="Morning, after workout..."
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    {formError && (
                      <p className="text-[11px] text-destructive">{formError}</p>
                    )}
                    <div className="flex gap-2">
                      {editingLogId && (
                        <Button
                          onClick={handleCancelEdit}
                          disabled={submitting}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleSave}
                        disabled={submitting || !formWeight}
                        className="flex-1"
                        size="sm"
                      >
                        {submitting
                          ? editingLogId
                            ? "Updating..."
                            : "Saving..."
                          : editingLogId
                          ? "Update Entry"
                          : "Save Entry"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Log List ───────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-[13px] font-bold">
                <Scale className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Recent Entries
              </p>
            </div>

            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No entries yet. Log your first weight above.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {logs.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5",
                      editingLogId === log.id && "bg-primary/5"
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {kgToDisplay(log.weight_kg, isImperial)} {unitLabel}
                        {log.body_fat_pct != null && (
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            {log.body_fat_pct}% BF
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(log.logged_date), "EEE, MMM d yyyy")}
                        {log.note ? ` · ${log.note}` : ""}
                      </p>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <Button
                        onClick={() => handleEdit(log)}
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Edit entry"
                        className="text-muted-foreground/70 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(log.id)}
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete entry"
                        className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  MEASUREMENTS TAB                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "measurements" && (
        <>
          {/* ── Measurements Chart ─────────────────────────────────── */}
          {!measLoading && measurements.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <p className="mb-3 text-[13px] font-bold text-foreground">
                Measurement Trends
              </p>
              <MeasurementsChart
                measurements={measurements}
                isImperial={isImperial}
              />
            </div>
          )}

          {/* ── Measurement Log Form ───────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
            <button
              onClick={toggleMeasForm}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  {measEditingId ? (
                    <Pencil className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="text-[13px] font-bold">
                  {measEditingId ? "Edit Measurement" : "Log Measurements"}
                </span>
              </div>
              <motion.div
                animate={{ rotate: measShowForm ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {measShowForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
                    {measEditingId && (
                      <p className="text-[11px] font-medium text-primary">
                        Editing an existing measurement entry
                      </p>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[11px]">Date</Label>
                      <Input
                        type="date"
                        value={measFormDate}
                        onChange={(e) => setMeasFormDate(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Measurements ({measUnit})
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {MEASUREMENT_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-[11px]">{f.label}</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            placeholder={f.placeholder}
                            value={measFormValues[f.key] ?? ""}
                            onChange={(e) =>
                              setMeasFormValues((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Note (optional)</Label>
                      <Input
                        placeholder="Morning, relaxed..."
                        value={measFormNote}
                        onChange={(e) => setMeasFormNote(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    {measFormError && (
                      <p className="text-[11px] text-destructive">{measFormError}</p>
                    )}

                    <div className="flex gap-2">
                      {measEditingId && (
                        <Button
                          onClick={() => {
                            setMeasEditingId(null);
                            resetMeasForm();
                          }}
                          disabled={measSubmitting}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleMeasSave}
                        disabled={measSubmitting}
                        className="flex-1"
                        size="sm"
                      >
                        {measSubmitting
                          ? measEditingId
                            ? "Updating..."
                            : "Saving..."
                          : measEditingId
                          ? "Update Entry"
                          : "Save Entry"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Measurements List ──────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-[13px] font-bold">
                <Ruler className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Recent Measurements
              </p>
            </div>

            {measLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : measurements.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Ruler className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No measurements logged yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Track waist, chest, arms and more to see your body change over time.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={toggleMeasForm}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Start logging metrics
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {measurements.slice(0, 30).map((m) => {
                  const parts = MEASUREMENT_FIELDS.filter(
                    (f) => m[f.key] != null
                  ).map(
                    (f) =>
                      `${f.label}: ${lengthToDisplay(m[f.key]!, isImperial, 1)}${measUnit}`
                  );

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5",
                        measEditingId === m.id && "bg-primary/5"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {format(parseISO(m.measured_date), "EEE, MMM d yyyy")}
                          {m.note ? ` · ${m.note}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-foreground">
                          {parts.join(" | ")}
                        </p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        <Button
                          onClick={() => handleMeasEdit(m)}
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit measurement"
                          className="text-muted-foreground/70 hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleMeasDelete(m.id)}
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Delete measurement"
                          className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---
## FILE: src/app/(app)/history/page.tsx
```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePrimaryColor } from "@/hooks/use-primary-color";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryNav } from "@/components/history/history-nav";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SessionSet = {
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type SessionItem = {
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  workout_templates: {
    name: string;
  } | null;
  workout_sets: SessionSet[];
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HistoryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const primaryColor = usePrimaryColor();
  const { preference, unitLabel } = useUnitPreferenceStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [dateUpdating, setDateUpdating] = useState(false);
  const [dateInputValue, setDateInputValue] = useState("");
  const [targetSession, setTargetSession] = useState<SessionItem | null>(null);

  function toDatetimeLocalValue(iso: string) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toDisplayWeight(kg: number) {
    return weightToDisplay(kg, preference === "imperial", 1);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          "id,name,started_at,completed_at,duration_seconds,workout_templates(name),workout_sets(set_number,reps,weight_kg,exercises(name,muscle_group))"
        )
        .eq("status", "completed")
        .order("started_at", { ascending: false });

      if (!active) return;

      if (error) {
        setSessions([]);
      } else {
        setSessions((data as unknown as SessionItem[]) ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, SessionItem[]>();

    for (const session of sessions) {
      const key = dayKey(new Date(session.started_at));
      const existing = grouped.get(key) ?? [];
      existing.push(session);
      grouped.set(key, existing);
    }

    return grouped;
  }, [sessions]);

  const selectedKey = dayKey(selectedDay);
  const sessionsForSelectedDay = sessionsByDay.get(selectedKey) ?? [];

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart); // Sunday
    const calEnd = endOfWeek(monthEnd);       // Saturday

    const days: Date[] = [];
    let current = calStart;
    while (current <= calEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [viewMonth]);

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm("Delete this workout from history?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast.error(error.message || "Failed to delete workout");
      return;
    }

    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    toast.success("Workout deleted");
  }

  function handleOpenDateDialog(session: SessionItem) {
    setTargetSession(session);
    setDateInputValue(toDatetimeLocalValue(session.started_at));
    setDateDialogOpen(true);
  }

  async function handleSaveDateChange() {
    if (!targetSession || !dateInputValue) return;

    const nextStart = new Date(dateInputValue);
    if (Number.isNaN(nextStart.getTime())) {
      toast.error("Please choose a valid date and time");
      return;
    }

    const oldStart = new Date(targetSession.started_at);
    const oldCompleted = targetSession.completed_at
      ? new Date(targetSession.completed_at)
      : null;
    const durationMs = oldCompleted
      ? Math.max(0, oldCompleted.getTime() - oldStart.getTime())
      : null;

    const updatePayload: {
      started_at: string;
      completed_at?: string | null;
      duration_seconds?: number | null;
    } = {
      started_at: nextStart.toISOString(),
    };

    if (durationMs != null) {
      const nextCompleted = new Date(nextStart.getTime() + durationMs);
      updatePayload.completed_at = nextCompleted.toISOString();
      updatePayload.duration_seconds = Math.round(durationMs / 1000);
    }

    setDateUpdating(true);
    const { error } = await supabase
      .from("workout_sessions")
      .update(updatePayload)
      .eq("id", targetSession.id);

    setDateUpdating(false);

    if (error) {
      toast.error(error.message || "Failed to update workout date");
      return;
    }

    setSessions((prev) =>
      prev.map((session) =>
        session.id === targetSession.id
          ? {
            ...session,
            started_at: updatePayload.started_at,
            completed_at:
              updatePayload.completed_at === undefined
                ? session.completed_at
                : updatePayload.completed_at,
            duration_seconds:
              updatePayload.duration_seconds === undefined
                ? session.duration_seconds
                : updatePayload.duration_seconds,
          }
          : session
      )
    );

    setDateDialogOpen(false);
    setTargetSession(null);
    setDateInputValue("");
    toast.success("Workout date updated");
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-6 pb-28 md:px-6 lg:px-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="History"
          subtitle="Calendar + daily logs with templates, muscle groups, reps, and sets."
        />
        <HistoryNav />
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ── Custom Calendar ────────────────────────────────────────── */}
        <div className="h-fit rounded-2xl border border-border/60 bg-card/30 p-4">
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <h3 className="text-[13px] font-bold text-foreground">
              {format(viewMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = dayKey(day);
              const inMonth = isSameMonth(day, viewMonth);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              const workoutCount = (sessionsByDay.get(key) ?? []).length;
              const hasWorkout = workoutCount > 0;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(day);
                    if (!isSameMonth(day, viewMonth)) {
                      setViewMonth(startOfMonth(day));
                    }
                  }}
                  className="relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-200 hover:bg-border/30"
                  style={
                    selected
                      ? {
                          backgroundColor: primaryColor,
                          color: "white",
                          boxShadow: `0 0 12px 2px ${primaryColor}44`,
                        }
                      : hasWorkout && !selected
                      ? {
                          backgroundColor: `${primaryColor}18`,
                          boxShadow: `inset 0 0 0 1.5px ${primaryColor}55`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`text-[13px] tabular-nums font-semibold leading-none ${
                      selected
                        ? "text-white"
                        : !inMonth
                        ? "text-muted-foreground/30"
                        : hasWorkout
                        ? "font-bold"
                        : "text-foreground/80"
                    }`}
                    style={
                      hasWorkout && !selected ? { color: primaryColor } : undefined
                    }
                  >
                    {format(day, "d")}
                  </span>

                  {/* Workout indicator dot */}
                  {hasWorkout && (
                    <div
                      className="mt-0.5 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: selected ? "white" : primaryColor,
                        boxShadow: selected
                          ? "0 0 4px rgba(255,255,255,0.6)"
                          : `0 0 4px ${primaryColor}66`,
                      }}
                    />
                  )}

                  {/* Today ring (when not selected) */}
                  {today && !selected && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{
                        boxShadow: `inset 0 0 0 1.5px ${primaryColor}40`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected Day Details ───────────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card/30 p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-foreground">{format(selectedDay, "EEEE, MMMM d")}</h3>
          </div>
          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading history...</p> : null}

            {!loading && sessionsForSelectedDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed workouts on this day.</p>
            ) : null}

            {sessionsForSelectedDay.map((session) => {
              const muscleGroups = [...new Set(
                session.workout_sets
                  .map((set) => set.exercises?.muscle_group)
                  .filter((value): value is string => Boolean(value))
              )];

              const totalSets = session.workout_sets.length;
              const totalReps = session.workout_sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);

              const byExercise = new Map<string, SessionSet[]>();
              for (const set of session.workout_sets) {
                const key = set.exercises?.name ?? "Unknown Exercise";
                const current = byExercise.get(key) ?? [];
                current.push(set);
                byExercise.set(key, current);
              }

              return (
                <div key={session.id} className="rounded-2xl border border-border/60 bg-card/30 p-5">
                  <div className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-base font-semibold text-foreground">{session.name}</h4>
                        <p className="truncate text-xs text-muted-foreground">
                          Template: {session.workout_templates?.name ?? "No template"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {totalSets} sets
                          </span>
                          <span className="rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {totalReps} reps
                          </span>
                          <span className="max-w-[200px] truncate rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {muscleGroups.length > 0 ? muscleGroups.join(", ") : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => router.push(`/history/${session.id}/edit`)}
                        >
                          <Pencil className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => handleOpenDateDialog(session)}
                        >
                          <CalendarClock className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Change Date</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 rounded-xl"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[...byExercise.entries()].map(([exerciseName, sets]) => (
                      <div key={exerciseName} className="rounded-xl border border-border/50 bg-card/40 p-3 text-sm">
                        <p className="min-w-0 truncate font-medium text-foreground">{exerciseName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sets.map((set, i) => (
                            <span
                              key={i}
                              className="inline-flex rounded-md bg-muted/40 px-2 py-0.5 text-[11px] tabular-nums font-semibold"
                            >
                              {set.weight_kg != null ? `${toDisplayWeight(set.weight_kg)} ${unitLabel}` : "BW"} x {set.reps ?? 0}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Workout Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workout-date-time">Date and time</Label>
            <Input
              id="workout-date-time"
              type="datetime-local"
              value={dateInputValue}
              onChange={(e) => setDateInputValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDateDialogOpen(false)}
              disabled={dateUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDateChange} disabled={dateUpdating}>
              {dateUpdating ? "Saving..." : "Save Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---
## FILE: src/app/(app)/history/progress/page.tsx
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, kgToLbs } from "@/lib/units";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  BarChart3,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryNav } from "@/components/history/history-nav";
// pdf-export loaded dynamically in handleExportPDF to reduce bundle
const ProgressCharts = {
  SparklineChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.SparklineChart),
    { ssr: false }
  ),
  StrengthLineChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.StrengthLineChart),
    {
      loading: () => <Skeleton className="h-[260px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
  StackedVolumeBarChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.StackedVolumeBarChart),
    {
      loading: () => <Skeleton className="h-[260px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
  CategoryMiniBarChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.CategoryMiniBarChart),
    {
      loading: () => <Skeleton className="h-[140px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
};

// ─── Types ──────────────────────────────────────────────────────────────────

type RawSet = {
  session_id: string;
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  set_type: string;
  workout_sessions: {
    started_at: string;
    status: string;
  };
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type RawSession = {
  id: string;
  name: string;
  started_at: string;
  total_volume_kg: number | null;
};

// ─── Volume category mapping ──────────────────────────────────────────────────

const VOLUME_CATEGORIES: Record<string, string> = {
  chest: "Upper Body",
  back: "Upper Body",
  shoulders: "Upper Body",
  arms: "Upper Body",
  legs: "Legs",
  core: "Core",
  full_body: "Full Body",
};

const VOLUME_CATEGORY_COLORS: Record<string, string> = {
  "Upper Body": "var(--color-primary)",
  Legs: "#f87171",
  Core: "#facc15",
  "Full Body": "#34d399",
};

const VOLUME_CATEGORY_ORDER = ["Upper Body", "Legs", "Core", "Full Body"] as const;

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (t: string) => void;
}) {
  const tabs = [
    { id: "strength", label: "Strength", icon: TrendingUp },
    { id: "volume", label: "Volume", icon: BarChart3 },
  ];
  return (
    <div className="flex gap-0.5 rounded-2xl border border-border/60 bg-card/40 p-1.5">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-semibold transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function PillToggle({
  opts,
  active,
  onChange,
}: {
  opts: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex max-w-full gap-0.5 overflow-x-auto scrollbar-none rounded-full p-1">
      {opts.map((o) => {
        const on = active === o;
        return (
          <motion.button
            key={o}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(o)}
            className={cn(
              "shrink-0 whitespace-nowrap h-8 rounded-full px-3.5 text-[11px] font-semibold transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Sparkline card ───────────────────────────────────────────────────────────

function SparklineCard({
  name,
  muscleGroup,
  dataPoints,
  trend,
  onClick,
}: {
  name: string;
  muscleGroup: string;
  dataPoints: { date: string; value: number }[];
  trend: number;
  onClick: () => void;
}) {
  const trendLabel =
    trend > 0 ? `+${Math.round(trend)}%` : trend < 0 ? `${Math.round(trend)}%` : "No change";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-border/60 bg-card/30 p-4 text-left transition-all hover:border-primary/30 hover:bg-card/80"
    >
      <p className="text-[13px] font-semibold min-w-0 truncate text-foreground">{name}</p>
      <p className="text-[10px] capitalize text-muted-foreground">
        {muscleGroup?.replace("_", " ")}
      </p>

      <div className="mt-1.5 h-[60px] w-full">
        <ProgressCharts.SparklineChart name={name} dataPoints={dataPoints} />
      </div>

      <div className="mt-1 flex justify-end">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums",
            trend > 0
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
              : trend < 0
                ? "border-red-400/20 bg-red-400/10 text-red-400"
                : "border-border/60 bg-muted/30 text-muted-foreground"
          )}
        >
          {trendLabel}
        </span>
      </div>
    </motion.button>
  );
}

// ─── Empty / Loading states ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[260px] w-full rounded-2xl" />
    </div>
  );
}

function SparklineSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[130px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const supabase = useMemo(() => createClient(), []);
  const { preference: unitPreference, unitLabel } = useUnitPreferenceStore();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<RawSet[]>([]);
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [strengthMetric, setStrengthMetric] = useState<"score" | "weight">("score");

  const [tab, setTab] = useState("strength");
  const [strengthView, setStrengthView] = useState<"all" | "single">("all");
  const [volumeView, setVolumeView] = useState("Stacked");
  const [isExporting, setIsExporting] = useState(false);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [setsRes, sessionsRes] = await Promise.all([
        supabase
          .from("workout_sets")
          .select(
            `
            session_id, exercise_id, reps, weight_kg, set_type,
            workout_sessions!inner(started_at, status),
            exercises(name, muscle_group)
          `
          )
          .eq("workout_sessions.status", "completed")
          .eq("workout_sessions.user_id", user.id),
        supabase
          .from("workout_sessions")
          .select("id, name, started_at, total_volume_kg")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("started_at", { ascending: true }),
      ]);

      if (!active) return;

      if (setsRes.error) {
        console.error("[Progress] sets query error:", setsRes.error);
      }
      if (sessionsRes.error) {
        console.error("[Progress] sessions query error:", sessionsRes.error);
      }

      const rows = (setsRes.data ?? []) as unknown as RawSet[];
      const sessionRows = (sessionsRes.data ?? []) as RawSession[];
      setSets(rows);
      setSessions(sessionRows);

      const exercisesById = new Map<string, string>();
      for (const row of rows) {
        if (row.exercises?.name)
          exercisesById.set(row.exercise_id, row.exercises.name);
      }
      const options = [...exercisesById.entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      );
      if (options.length > 0) setSelectedExerciseId(options[0][0]);

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const exerciseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of sets) {
      if (s.exercises?.name) byId.set(s.exercise_id, s.exercises.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  function convertWeight(kg: number) {
    return weightToDisplay(kg, unitPreference === "imperial", 1);
  }

  // ── Sparklines for "All Exercises" ────────────────────────────────────────

  const allExerciseSparklines = useMemo(() => {
    const byExercise = new Map<
      string,
      {
        name: string;
        muscleGroup: string;
        sessions: Map<string, { rawDate: string; topScore: number; topWeight: number }>;
      }
    >();

    for (const s of sets) {
      if (!s.exercises?.name || s.weight_kg == null) continue;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;

      let exercise = byExercise.get(s.exercise_id);
      if (!exercise) {
        exercise = {
          name: s.exercises.name,
          muscleGroup: s.exercises.muscle_group,
          sessions: new Map(),
        };
        byExercise.set(s.exercise_id, exercise);
      }

      const existing = exercise.sessions.get(s.session_id);
      if (!existing || score > existing.topScore) {
        exercise.sessions.set(s.session_id, {
          rawDate: s.workout_sessions.started_at,
          topScore: score,
          topWeight: weight,
        });
      }
    }

    return [...byExercise.entries()]
      .map(([id, data]) => {
        const points = [...data.sessions.values()]
          .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
          .map((dp) => ({
            date: format(new Date(dp.rawDate), "MMM d"),
            value: strengthMetric === "score" ? Math.round(dp.topScore) : dp.topWeight,
          }));

        const first = points[0]?.value ?? 0;
        const last = points[points.length - 1]?.value ?? 0;
        const trend = first > 0 ? ((last - first) / first) * 100 : 0;

        return {
          exerciseId: id,
          name: data.name,
          muscleGroup: data.muscleGroup,
          dataPoints: points,
          trend,
        };
      })
      .filter((ex) => ex.dataPoints.length >= 2)
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, unitPreference, strengthMetric]);

  // ── Single exercise strength data ─────────────────────────────────────────

  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const bySession = new Map<
      string,
      {
        rawDate: string;
        topSetScore: number | null;
        topSetWeight: number;
        topSetReps: number;
        topWeight: number;
        topWeightReps: number;
      }
    >();

    for (const s of sets) {
      if (s.exercise_id !== selectedExerciseId || s.weight_kg == null) continue;
      const rawDate = s.workout_sessions.started_at;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;
      const hasValid = s.reps != null && s.reps > 0;

      const ex = bySession.get(s.session_id);
      if (!ex) {
        bySession.set(s.session_id, {
          rawDate,
          topSetScore: hasValid ? score : null,
          topSetWeight: weight,
          topSetReps: reps,
          topWeight: weight,
          topWeightReps: reps,
        });
        continue;
      }
      if (hasValid && (ex.topSetScore == null || score > ex.topSetScore)) {
        ex.topSetScore = score;
        ex.topSetWeight = weight;
        ex.topSetReps = reps;
      }
      if (weight > ex.topWeight) {
        ex.topWeight = weight;
        ex.topWeightReps = reps;
      }
    }

    return [...bySession.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .filter((v) => (strengthMetric === "weight" ? true : v.topSetScore != null))
      .map((v) => ({
        date: format(new Date(v.rawDate), "MMM d"),
        topSetScore: v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0,
        topSetWeight: v.topSetWeight,
        topSetReps: v.topSetReps,
        topWeight: v.topWeight,
        topWeightReps: v.topWeightReps,
        displayValue:
          strengthMetric === "score"
            ? v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0
            : v.topWeight,
        rawDate: v.rawDate,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, selectedExerciseId, strengthMetric, unitPreference]);

  // Best stats for single exercise view
  const bestStats = useMemo(() => {
    if (strengthData.length === 0) return null;
    let bestWeight = { value: 0, reps: 0, date: "" };
    let bestScore = { value: 0, weight: 0, reps: 0, date: "" };
    for (const d of strengthData) {
      if (d.topWeight > bestWeight.value) {
        bestWeight = { value: d.topWeight, reps: d.topWeightReps, date: d.date };
      }
      if (d.topSetScore > bestScore.value) {
        bestScore = { value: d.topSetScore, weight: d.topSetWeight, reps: d.topSetReps, date: d.date };
      }
    }
    return { bestWeight, bestScore };
  }, [strengthData]);

  // ── Volume by category ────────────────────────────────────────────────────

  const categoryVolumeData = useMemo(() => {
    const sessionMap = new Map<
      string,
      { rawDate: string; categories: Record<string, number> }
    >();

    for (const s of sets) {
      if (s.weight_kg == null || !s.exercises?.muscle_group) continue;
      const weight = unitPreference === "imperial" ? kgToLbs(s.weight_kg) : s.weight_kg;
      const volume = weight * (s.reps ?? 0);
      const category = VOLUME_CATEGORIES[s.exercises.muscle_group] ?? "Full Body";

      let session = sessionMap.get(s.session_id);
      if (!session) {
        session = {
          rawDate: s.workout_sessions.started_at,
          categories: { "Upper Body": 0, Legs: 0, Core: 0, "Full Body": 0 },
        };
        sessionMap.set(s.session_id, session);
      }
      session.categories[category] += volume;
    }

    return [...sessionMap.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-30)
      .map((s) => ({
        date: format(new Date(s.rawDate), "MMM d"),
        "Upper Body": Math.round(s.categories["Upper Body"]),
        Legs: Math.round(s.categories["Legs"]),
        Core: Math.round(s.categories["Core"]),
        "Full Body": Math.round(s.categories["Full Body"]),
        total: Math.round(
          s.categories["Upper Body"] + s.categories["Legs"] + s.categories["Core"] + s.categories["Full Body"]
        ),
      }));
  }, [sets, unitPreference]);

  // Volume summary stats
  const volumeStats = useMemo(() => {
    if (categoryVolumeData.length === 0) return null;
    const last = categoryVolumeData[categoryVolumeData.length - 1];
    const avg = categoryVolumeData.reduce((s, d) => s + d.total, 0) / categoryVolumeData.length;
    const prevAvg =
      categoryVolumeData.length > 1
        ? categoryVolumeData.slice(0, -1).reduce((s, d) => s + d.total, 0) / (categoryVolumeData.length - 1)
        : avg;
    const delta = prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : 0;
    return {
      latest: last?.total ?? 0,
      avg: Math.round(avg),
      delta: Math.round(delta * 10) / 10,
    };
  }, [categoryVolumeData]);

  const totalSessions = sessions.length;

  // ── PDF Export ────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { generateProgressPDF } = await import("@/lib/pdf-export");
      await generateProgressPDF({
        userName: "Athlete",
        reportDate: new Date(),
        totalSessions,
        totalPRs: 0,
        avgVolume: volumeStats?.avg,
        strengthCharts: allExerciseSparklines.map((c) => ({ ...c, unitLabel })),
        personalRecords: [],
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md pb-28">
        {/* Header */}
        <div className="px-5 pb-5 pt-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  Analytics
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>
              </div>
              <HistoryNav />
            </div>
            {sessions.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleExportPDF}
                disabled={isExporting}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isExporting ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                {isExporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                )}
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </motion.button>
            )}
          </div>

          {!loading && totalSessions > 0 && (
            <p className="mb-4 text-[13px] text-muted-foreground">
              {totalSessions} session{totalSessions !== 1 ? "s" : ""}
            </p>
          )}

          <TabBar active={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            {/* ── STRENGTH TAB ─────────────────────────────────────────── */}
            {tab === "strength" && (
              <motion.div
                key="strength"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <SparklineSkeleton />
                ) : exerciseOptions.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {strengthView === "all" ? (
                      <motion.div
                        key="all"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="All Exercises"
                            onChange={(v) => v === "Single Exercise" && setStrengthView("single")}
                          />
                        </div>
                        <div className="mb-4">
                          <PillToggle
                            opts={["Top Set Score", "Top Weight"]}
                            active={strengthMetric === "score" ? "Top Set Score" : "Top Weight"}
                            onChange={(v) => setStrengthMetric(v === "Top Set Score" ? "score" : "weight")}
                          />
                        </div>

                        {allExerciseSparklines.length === 0 ? (
                          <EmptyState message="Need at least 2 sessions per exercise to show trends" />
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {allExerciseSparklines.map((ex) => (
                              <SparklineCard
                                key={ex.exerciseId}
                                name={ex.name}
                                muscleGroup={ex.muscleGroup}
                                dataPoints={ex.dataPoints}
                                trend={ex.trend}
                                onClick={() => {
                                  setSelectedExerciseId(ex.exerciseId);
                                  setStrengthView("single");
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="single"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => setStrengthView("all")}
                          className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-primary transition hover:text-primary/80"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to overview
                        </button>

                        {/* Exercise dropdown */}
                        <div className="relative mb-4">
                          <select
                            value={selectedExerciseId}
                            onChange={(e) => setSelectedExerciseId(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-border/60 bg-card px-4 py-2.5 pr-10 text-sm font-semibold text-foreground transition focus:border-primary/40 focus:outline-none"
                          >
                            {exerciseOptions.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>

                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="Single Exercise"
                            onChange={(v) => v === "All Exercises" && setStrengthView("all")}
                          />
                        </div>

                        {strengthData.length === 0 ? (
                          <EmptyState message="No data for this exercise" />
                        ) : (
                          <>
                            <div className="mb-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-[13px] font-bold text-foreground">
                                  {exerciseOptions.find((e) => e.id === selectedExerciseId)?.name ?? "Exercise"}
                                </p>
                                <span className="rounded-full border border-border/50 bg-card/40 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                                  {strengthMetric === "score" ? "Top Set Score" : `Max Weight (${unitLabel})`}
                                </span>
                              </div>
                              <div className="h-[240px] sm:h-[300px]">
                                <ProgressCharts.StrengthLineChart strengthData={strengthData} unitLabel={unitLabel} />
                              </div>
                            </div>

                            {/* Best stats pills */}
                            {bestStats && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Best Weight</p>
                                  <p className="tabular-nums text-[22px] font-black leading-none text-primary">
                                    {bestStats.bestWeight.value} {unitLabel}
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {bestStats.bestWeight.date} · {bestStats.bestWeight.reps} reps
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Best Score</p>
                                  <p className="tabular-nums text-[22px] font-black leading-none text-primary">
                                    {Math.round(bestStats.bestScore.value).toLocaleString()} pts
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {bestStats.bestScore.date} · {bestStats.bestScore.reps} reps
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

            {/* ── VOLUME TAB ───────────────────────────────────────────── */}
            {tab === "volume" && (
              <motion.div
                key="volume"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <ChartSkeleton />
                ) : categoryVolumeData.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {volumeView === "Stacked" ? (
                      <motion.div
                        key="stacked"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        {/* Legend */}
                        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => (
                            <div key={cat} className="flex items-center gap-1.5">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ background: VOLUME_CATEGORY_COLORS[cat] }}
                              />
                              <span className="text-[11px] text-muted-foreground">{cat}</span>
                            </div>
                          ))}
                        </div>

                        {/* Stacked chart */}
                        <div className="mb-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Session Volume ({unitLabel})
                          </p>
                          <ProgressCharts.StackedVolumeBarChart
                            categoryVolumeData={categoryVolumeData}
                            unitLabel={unitLabel}
                            volumeCategoryOrder={VOLUME_CATEGORY_ORDER}
                            volumeCategoryColors={VOLUME_CATEGORY_COLORS}
                          />
                        </div>

                        {/* Volume summary */}
                        {volumeStats && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Latest Session</p>
                              <p className="tabular-nums text-[22px] font-black leading-none text-foreground">
                                {(volumeStats.latest / 1000).toFixed(1)}k
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{unitLabel}</p>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Avg / Session</p>
                              <p className="tabular-nums text-[22px] font-black leading-none text-foreground">
                                {(volumeStats.avg / 1000).toFixed(1)}k
                              </p>
                              <div className="mt-0.5 flex items-center gap-1">
                                <p className="text-[10px] text-muted-foreground">{unitLabel}</p>
                                {volumeStats.delta !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold tabular-nums",
                                      volumeStats.delta > 0 ? "text-emerald-400" : "text-red-400"
                                    )}
                                  >
                                    {volumeStats.delta > 0 ? "+" : ""}
                                    {volumeStats.delta}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="bycategory"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => {
                            const color = VOLUME_CATEGORY_COLORS[cat];
                            const hasData = categoryVolumeData.some(
                              (d) => (d[cat as keyof typeof d] as number) > 0
                            );
                            return (
                              <div key={cat} className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-4">
                                <p className="mb-2.5 text-xs font-semibold" style={{ color }}>
                                  {cat}
                                </p>
                                {!hasData ? (
                                  <p className="py-8 text-center text-[10px] text-muted-foreground">No data</p>
                                ) : (
                                  <ProgressCharts.CategoryMiniBarChart
                                    categoryVolumeData={categoryVolumeData}
                                    category={cat}
                                    color={color}
                                    unitLabel={unitLabel}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>


    </div>
  );
}
```

---
## FILE: src/app/(app)/history/prs/prs-client.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Medal, Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUP_LABELS } from "@/lib/constants";

type PR = {
  id: string;
  name: string;
  muscle_group: string;
  pr_kg: number;
  reps: number | null;
  achieved_at: string;
  e1rm_kg: number | null;
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  biceps: "bg-amber-500/20 text-amber-400",
  triceps: "bg-orange-500/20 text-orange-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  glutes: "bg-pink-500/20 text-pink-400",
  abs: "bg-cyan-500/20 text-cyan-400",
  cardio: "bg-indigo-500/20 text-indigo-400",
};

const MUSCLE_DOT_COLORS: Record<string, string> = {
  chest: "bg-rose-400",
  back: "bg-sky-400",
  shoulders: "bg-violet-400",
  biceps: "bg-amber-400",
  triceps: "bg-orange-400",
  legs: "bg-emerald-400",
  glutes: "bg-pink-400",
  abs: "bg-cyan-400",
  cardio: "bg-indigo-400",
};

function getMuscleColor(group: string) {
  return MUSCLE_COLORS[group.toLowerCase()] ?? "bg-muted/50 text-muted-foreground";
}

export function PRsClient({
  prs,
  muscleGroups,
}: {
  prs: PR[];
  muscleGroups: string[];
}) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const displayWeight = (kg: number) =>
    isImperial
      ? `${Math.round(kgToLbs(kg))} lbs`
      : `${Math.round(kg * 10) / 10} kg`;

  const filtered = useMemo(() => {
    return prs.filter((pr) => {
      const matchGroup = activeGroup === "all" || pr.muscle_group === activeGroup;
      const matchQuery =
        !query || pr.name.toLowerCase().includes(query.toLowerCase());
      return matchGroup && matchQuery;
    });
  }, [prs, activeGroup, query]);

  // Group filtered PRs by muscle group
  const grouped = useMemo(() => {
    const map = new Map<string, PR[]>();
    for (const pr of filtered) {
      if (!map.has(pr.muscle_group)) map.set(pr.muscle_group, []);
      map.get(pr.muscle_group)!.push(pr);
    }
    return map;
  }, [filtered]);

  const topPRs = useMemo(() => {
    return [...prs]
      .sort((a, b) => {
        const aW = isImperial ? kgToLbs(a.pr_kg) : a.pr_kg;
        const bW = isImperial ? kgToLbs(b.pr_kg) : b.pr_kg;
        return bW - aW;
      })
      .slice(0, 3);
  }, [prs, isImperial]);

  return (
    <div className="space-y-5">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topPRs.map((pr, idx) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-2xl border border-border/60 bg-card/30 p-4 text-center"
          >
            <div className="mb-1.5 flex justify-center">
              <Medal className={cn("h-7 w-7", idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-400" : "text-amber-600")} />
            </div>
            <p className="truncate min-w-0 text-[12px] sm:text-[13px] font-semibold">{pr.name}</p>
            <p className="tabular-nums text-[22px] sm:text-[26px] font-black leading-none text-foreground">
              {displayWeight(pr.pr_kg)}
            </p>
            {pr.reps && (
              <p className="mt-1 text-[11px] text-muted-foreground">x {pr.reps} reps</p>
            )}
            {pr.e1rm_kg != null && pr.e1rm_kg > pr.pr_kg && (
              <p className="mt-0.5 text-[10px] text-primary/70 font-medium">
                e1RM {displayWeight(pr.e1rm_kg)}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Search + Muscle Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercise…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGroup("all")}
            className={cn(
              "h-8 rounded-full px-3.5 text-[11px] font-semibold transition-colors",
              activeGroup === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setActiveGroup(mg === activeGroup ? "all" : mg)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[11px] font-semibold capitalize transition-colors",
                activeGroup === mg
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {(MUSCLE_GROUP_LABELS as Record<string, string>)[mg] ?? mg}
            </button>
          ))}
        </div>
      </div>

      {/* PR Groups */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">No results</p>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([group, groupPRs]) => (
            <div key={group} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full shrink-0", MUSCLE_DOT_COLORS[group.toLowerCase()] ?? "bg-muted-foreground")} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                  {(MUSCLE_GROUP_LABELS as Record<string, string>)[group] ?? group}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {groupPRs.length} exercise{groupPRs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {groupPRs.map((pr, idx) => (
                  <motion.div
                    key={pr.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between gap-3 min-w-0 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold min-w-0 truncate">{pr.name}</p>
                        {pr.achieved_at && (
                          <p className="text-[11px] text-muted-foreground shrink-0">
                            {format(parseISO(pr.achieved_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="tabular-nums text-[15px] font-black shrink-0">
                        {displayWeight(pr.pr_kg)}
                      </p>
                      {pr.reps && (
                        <p className="text-[11px] text-muted-foreground">x {pr.reps} reps</p>
                      )}
                      {pr.e1rm_kg != null && pr.e1rm_kg > pr.pr_kg && (
                        <p className="text-[10px] text-primary/70 font-medium">
                          e1RM {displayWeight(pr.e1rm_kg)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/app/(app)/history/stats/page.tsx
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { HistoryNav } from "@/components/history/history-nav";
import type { HistoryStatsResponse } from "@/app/api/history/stats/route";
import {
  BarChart3,
  Dumbbell,
  CalendarDays,
  Clock,
  Flame,
  Weight,
} from "lucide-react";

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number, isImperial: boolean) {
  if (isImperial) {
    const lbs = kgToLbs(kg);
    if (lbs >= 2000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${Math.round(lbs).toLocaleString()} lbs`;
  }
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export default function HistoryStatsPage() {
  const router = useRouter();
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [stats, setStats] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch("/api/history/stats");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;

      const data: HistoryStatsResponse = await res.json();
      if (active) {
        setStats(data);
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [router]);

  const maxCount = stats?.top_muscle_groups[0]?.set_count ?? 1;

  const months = useMemo(() => {
    if (!stats) return [];
    // Fill in missing months from last 6 months
    const monthMap: Record<string, { sessions: number; volume_kg: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { sessions: 0, volume_kg: 0 };
    }
    for (const m of stats.monthly_breakdown) {
      if (monthMap[m.month_key]) {
        monthMap[m.month_key] = { sessions: m.sessions, volume_kg: m.volume_kg };
      }
    }
    return Object.entries(monthMap);
  }, [stats]);

  const STAT_CARDS = stats
    ? [
        { icon: Dumbbell, label: "Total Sessions", value: stats.total_sessions.toLocaleString(), color: "text-primary" },
        { icon: Weight, label: "Total Volume", value: formatVolume(stats.total_volume_kg, isImperial), color: "text-amber-400" },
        { icon: Clock, label: "Avg Session", value: stats.avg_duration_seconds > 0 ? formatDuration(stats.avg_duration_seconds) : "—", color: "text-sky-400" },
        { icon: Flame, label: "Longest Streak", value: `${stats.longest_streak}d`, color: "text-rose-400" },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Workout Stats</h1>
        </div>
        <HistoryNav />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        </div>
      ) : stats && stats.total_sessions > 0 ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/60 bg-card/30 p-5 text-center"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-card/70">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <p className="tabular-nums text-[28px] font-black leading-none text-foreground">{value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Muscle Group Bar Chart */}
          {stats.top_muscle_groups.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <Dumbbell className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-bold">Top Muscle Groups</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="p-5 space-y-3">
                {stats.top_muscle_groups.map(({ muscle_group, set_count }) => (
                  <div key={muscle_group} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium capitalize">{muscle_group}</span>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{set_count} sets</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(set_count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Breakdown */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-bold">Monthly Breakdown</span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="p-5 space-y-2.5">
              {months.map(([key, data]) => {
                const [year, month] = key.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", {
                  month: "short",
                  year: "2-digit",
                });
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3">
                    <span className="text-[12px] font-semibold">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-[13px] font-bold text-foreground">
                        {data.sessions} sessions
                      </span>
                      <span className="tabular-nums text-[13px] font-bold text-muted-foreground">
                        {formatVolume(data.volume_kg, isImperial)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No workouts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Complete your first workout to see stats here.</p>
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/app/(app)/marketplace/page.tsx
```tsx
import { MarketplaceContent } from "@/components/marketplace/marketplace-content";

export const metadata = {
  title: "Marketplace — Fit-Hub",
  description: "Browse and import community-built workout templates.",
};

export default function MarketplacePage() {
  return <MarketplaceContent />;
}
```

---
## FILE: src/app/(app)/pods/page.tsx
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Plus, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePods } from "@/hooks/use-pods";

export default function PodsPage() {
  const router = useRouter();
  const { pods, loading, error } = usePods();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pods</h1>
          <p className="text-sm text-muted-foreground">Accountability groups for consistency</p>
        </div>
        <Button onClick={() => router.push("/pods/create")} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      {/* Empty State */}
      {pods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">No pods yet</p>
              <p className="text-sm text-muted-foreground">
                Create or join a pod to stay accountable
              </p>
            </div>
            <Button onClick={() => router.push("/pods/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Pod
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Pod List */
        <div className="space-y-3">
          {pods.map((pod) => (
            <Card
              key={pod.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => router.push(`/pods/${pod.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 truncate text-base">{pod.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pod.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pod.description}
                  </p>
                )}

                {/* Member avatars */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {pod.members.slice(0, 5).map((member, idx) => (
                      <div
                        key={member.user_id}
                        className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold"
                        style={{ zIndex: 5 - idx }}
                      >
                        {(member.display_name || member.username || "?")[0].toUpperCase()}
                      </div>
                    ))}
                    {pod.member_count > 5 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        +{pod.member_count - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pod.members.map(m => m.display_name || m.username).slice(0, 2).join(", ")}
                    {pod.member_count > 2 && ` +${pod.member_count - 2} more`}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Stay consistent together</p>
              <p className="text-muted-foreground">
                Set weekly workout goals, track progress, and encourage your pod members
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---
## FILE: src/app/(app)/pods/[podId]/page.tsx
```tsx
"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Target, MessageSquare, Trash2, LogOut, Plus, Trophy, Calendar, Flame, Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePodDetail } from "@/hooks/use-pods";
import { InviteMemberDialog } from "@/components/pods/invite-member-dialog";
import { SetCommitmentDialog } from "@/components/pods/set-commitment-dialog";
import { SendMessageDialog } from "@/components/pods/send-message-dialog";
import { CreateChallengeDialog } from "@/components/pods/create-challenge-dialog";
import { PodLeaderboard } from "@/components/pods/pod-leaderboard";
import { createClient } from "@/lib/supabase/client";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import type { PodChallenge } from "@/types/pods";

interface PageProps {
  params: Promise<{ podId: string }>;
}

function formatChallengeDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChallengeTypeIcon({ type }: { type: PodChallenge["challenge_type"] }) {
  if (type === "volume") return <Trophy className="h-3.5 w-3.5" />;
  return <Flame className="h-3.5 w-3.5" />;
}

function ChallengesSection({ podId, currentUserId }: { podId: string; currentUserId: string | null }) {
  const [challenges, setChallenges] = useState<(PodChallenge & { is_active: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pods/${podId}/challenges`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [podId]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  async function handleDelete(challengeId: string) {
    if (!confirm("Delete this challenge?")) return;
    const res = await fetch(`/api/pods/${podId}/challenges/${challengeId}`, { method: "DELETE" });
    if (res.ok) {
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }
  }

  const activeChallenges = challenges.filter((c) => c.is_active);
  const pastChallenges = challenges.filter((c) => !c.is_active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Challenges
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
      ) : challenges.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No challenges yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to compete with your pod!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeChallenges.map((challenge) => (
            <Card key={challenge.id} className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChallengeTypeIcon type={challenge.challenge_type} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{challenge.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatChallengeDate(challenge.start_date)} – {formatChallengeDate(challenge.end_date)}
                        {challenge.target_value && (
                          <> · target: {challenge.target_value} {challenge.challenge_type === "volume" ? "kg" : "sessions"}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/20 text-green-600 border-green-500/30">
                      Active
                    </Badge>
                    {currentUserId === challenge.created_by && (
                      <button
                        onClick={() => handleDelete(challenge.id)}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {pastChallenges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground pl-1">Past challenges</p>
              {pastChallenges.map((challenge) => (
                <Card key={challenge.id} className="opacity-60">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChallengeTypeIcon type={challenge.challenge_type} />
                        <p className="text-sm truncate">{challenge.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          ended {formatChallengeDate(challenge.end_date)}
                        </span>
                        {currentUserId === challenge.created_by && (
                          <button
                            onClick={() => handleDelete(challenge.id)}
                            className="text-muted-foreground/50 hover:text-destructive transition-colors text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <CreateChallengeDialog
        open={createOpen}
        podId={podId}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchChallenges}
      />
    </div>
  );
}

export default function PodDetailPage({ params }: PageProps) {
  const { podId } = use(params);
  const router = useRouter();
  const { pod, loading, error, inviteMember, setCommitment, sendMessage, leavePod, deletePod } = usePodDetail(podId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const isCreator = pod && currentUserId && pod.creator_id === currentUserId;
  const currentUserProgress = pod?.members_progress.find((m) => m.user_id === currentUserId);

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this pod?")) return;
    const success = await leavePod();
    if (success) router.push("/pods");
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this pod? This cannot be undone.")) return;
    const success = await deletePod(podId);
    if (success) router.push("/pods");
  }

  async function handleInvite(username: string) {
    const result = await inviteMember(username);
    if (result.success) {
      alert(result.message);
      setInviteOpen(false);
    } else {
      alert(result.message);
    }
  }

  async function handleSetCommitment(workouts: number) {
    const success = await setCommitment(workouts);
    if (success) setCommitmentOpen(false);
  }

  async function handleSendMessage(message: string, recipientId?: string) {
    const success = await sendMessage(message, recipientId);
    if (success) {
      setMessageOpen(false);
      setSelectedRecipient(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 space-y-4 md:max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 md:max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error || "Pod not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 space-y-4 md:max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {isCreator ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          )}
        </div>
      </div>

      {/* Pod Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{pod.name}</CardTitle>
              {pod.description && (
                <p className="text-sm text-muted-foreground mt-1">{pod.description}</p>
              )}
            </div>
            <Badge variant="secondary">{pod.member_count} / 8</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCommitmentOpen(true)} className="flex-1 min-w-[120px]">
              <Target className="h-4 w-4 mr-2" />
              {currentUserProgress && currentUserProgress.commitment > 0
                ? `${currentUserProgress.commitment}x/week`
                : "Set Goal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)} className="flex-1 min-w-[120px]">
              <MessageSquare className="h-4 w-4 mr-2" />
              Encourage
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="shrink-0">
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member Progress */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">This Week&apos;s Progress</h2>
        {pod.members_progress.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          return (
            <Card key={member.user_id} className={isCurrentUser ? "border-primary" : ""}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {member.display_name || member.username || "Unknown"}
                      {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                    </p>
                    {member.commitment > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {member.completed} / {member.commitment} workouts
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No goal set yet</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {member.streak > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Flame className="inline h-3 w-3" /> {member.streak} week{member.streak !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {!isCurrentUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRecipient(member.user_id);
                          setMessageOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {member.commitment > 0 && (
                  <div className="space-y-1">
                    <Progress
                      value={member.progress_percentage}
                      className={member.is_on_track ? "[&>div]:bg-green-500" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      {member.is_on_track ? <span className="inline-flex items-center gap-1">On track <Dumbbell className="inline h-3 w-3" /></span> : `${member.commitment - member.completed} to go`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Challenges + Live Leaderboard */}
      {POD_CHALLENGES_ENABLED && (
        <>
          <ChallengesSection podId={podId} currentUserId={currentUserId} />
          <PodLeaderboard podId={podId} />
        </>
      )}

      {/* Recent Messages */}
      {pod.recent_messages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent Messages</h2>
          <div className="space-y-2">
            {pod.recent_messages.map((msg) => (
              <Card key={msg.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {(msg.sender_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold">{msg.sender_name}</p>
                        {msg.recipient_id && (
                          <span className="text-xs text-muted-foreground">
                            → {msg.recipient_name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{msg.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {isCreator && (
        <InviteMemberDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onInvite={handleInvite}
        />
      )}

      <SetCommitmentDialog
        open={commitmentOpen}
        onClose={() => setCommitmentOpen(false)}
        onSetCommitment={handleSetCommitment}
        currentCommitment={currentUserProgress?.commitment}
      />

      <SendMessageDialog
        open={messageOpen}
        onClose={() => {
          setMessageOpen(false);
          setSelectedRecipient(null);
        }}
        onSendMessage={handleSendMessage}
        members={pod.members}
        recipientId={selectedRecipient}
      />
    </div>
  );
}
```

---
## FILE: src/app/(app)/settings/page.tsx
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronRight, Scale, Dumbbell, LayoutList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ExportDataCard } from "./export-data-card";
import { NotificationPreferencesCard } from "./notification-preferences-card";
import { SignOutButton } from "./sign-out-button";

const QUICK_ACCESS_LINKS = [
  {
    href: "/body",
    title: "Body Metrics",
    description: "Track weight and body composition over time",
    Icon: Scale,
    cta: "Open Body Metrics",
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Review Smart Launcher performance and trends",
    Icon: BarChart3,
    cta: "Open Analytics",
  },
  {
    href: "/workout/templates",
    title: "My Templates",
    description: "Manage and publish your workout templates",
    Icon: LayoutList,
    cta: "Open Templates",
  },
  {
    href: "/exercises",
    title: "Exercise Library",
    description: "Browse all available exercises",
    Icon: Dumbbell,
    cta: "Browse Library",
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-28 pt-6">
      <PageHeader title="Settings" />

      <Card className="border-border/60 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account & Preferences</CardTitle>
          <CardDescription className="text-xs">
            Update your profile, privacy, units, and theme in one place.
          </CardDescription>
        </CardHeader>
      </Card>

      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        userId={user.id}
      />

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutList className="h-4 w-4 text-primary" />
            Quick Access
          </CardTitle>
          <CardDescription className="text-xs">
            Jump to commonly used areas without leaving settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUICK_ACCESS_LINKS.map(({ href, title, description, Icon, cta }) => (
            <Button
              key={href}
              variant="outline"
              className="h-auto w-full justify-between px-3 py-3"
              asChild
            >
              <Link href={href}>
                <span className="flex items-start gap-3 text-left">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {cta}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <ExportDataCard />

      <NotificationPreferencesCard />

      <div className="border-t border-border/50 pt-2">
        <div className="flex justify-center">
          <SignOutButton
            label="Sign out of FitHub"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          />
        </div>
      </div>
    </div>
  );
}
```

---
## FILE: src/app/(app)/exercises/exercises-client.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExerciseRow } from "./page";

const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  arms: "bg-amber-500/20 text-amber-400",
  core: "bg-cyan-500/20 text-cyan-400",
  full_body: "bg-primary/20 text-primary",
};

const EQUIPMENT_BADGE_COLORS: Record<string, string> = {
  barbell: "bg-slate-500/20 text-slate-400",
  dumbbell: "bg-orange-500/20 text-orange-400",
  kettlebell: "bg-yellow-500/20 text-yellow-400",
  cable: "bg-teal-500/20 text-teal-400",
  machine: "bg-indigo-500/20 text-indigo-400",
  bodyweight: "bg-lime-500/20 text-lime-400",
  band: "bg-fuchsia-500/20 text-fuchsia-400",
};

function ExerciseCard({ ex, muscleGroupLabels, equipmentLabels }: {
  ex: ExerciseRow;
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-border/50 bg-card/40 overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ex.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                MUSCLE_BADGE_COLORS[ex.muscle_group] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {muscleGroupLabels[ex.muscle_group] ?? ex.muscle_group}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                EQUIPMENT_BADGE_COLORS[ex.equipment] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {equipmentLabels[ex.equipment] ?? ex.equipment}
            </span>
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
              {ex.category}
            </span>
          </div>
        </div>
        <span className="ml-2 shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && ex.instructions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-3 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{ex.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ExercisesClient({
  exercises,
  muscleGroups,
  equipmentTypes,
  muscleGroupLabels,
  equipmentLabels,
}: {
  exercises: ExerciseRow[];
  muscleGroups: string[];
  equipmentTypes: string[];
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [activeMuscle, setActiveMuscle] = useState("all");
  const [activeEquipment, setActiveEquipment] = useState("all");

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchMuscle = activeMuscle === "all" || ex.muscle_group === activeMuscle;
      const matchEquip = activeEquipment === "all" || ex.equipment === activeEquipment;
      const matchQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
      return matchMuscle && matchEquip && matchQuery;
    });
  }, [exercises, activeMuscle, activeEquipment, query]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Muscle filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveMuscle("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeMuscle === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {muscleGroups.map((mg) => (
          <button
            key={mg}
            onClick={() => setActiveMuscle(mg === activeMuscle ? "all" : mg)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeMuscle === mg
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {muscleGroupLabels[mg] ?? mg}
          </button>
        ))}
      </div>

      {/* Equipment filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveEquipment("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeEquipment === "all"
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Any equipment
        </button>
        {equipmentTypes.map((eq) => (
          <button
            key={eq}
            onClick={() => setActiveEquipment(eq === activeEquipment ? "all" : eq)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeEquipment === eq
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {equipmentLabels[eq] ?? eq}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-muted-foreground">
        Showing {filtered.length} of {exercises.length} exercises
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No exercises match your filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              muscleGroupLabels={muscleGroupLabels}
              equipmentLabels={equipmentLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---
## FILE: src/app/(app)/layout.tsx
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeApplier } from "@/components/theme-applier";
import { PageTransition } from "@/components/layout/page-transition";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { SplashDismisser } from "@/components/layout/splash-dismisser";
import { HealthGuard } from "@/components/layout/health-guard";
import { CoachFabWrapper } from "@/components/coach/coach-fab-wrapper";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-svh bg-background">
      <ThemeApplier />
      <OfflineBanner />
      {/* pb accounts for bottom-nav height (6rem) + device safe-area inset.
          env(safe-area-inset-bottom,0px) is 0 on Android/desktop and up to
          34px on iPhone 14 Pro+, ensuring content is never hidden behind the
          nav or the home indicator on any device. */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <SplashDismisser />
      <HealthGuard />
      <CoachFabWrapper />
    </div>
  );
}
```
