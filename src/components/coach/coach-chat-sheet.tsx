"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowUp,
  Mic,
  Plus,
  Dumbbell,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  Brain,
  Timer,
  CircleCheck,
  Check,
  Apple,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { T, statusMessages, orbColors } from "@/lib/coach-tokens";
import type { OrbState } from "@/lib/coach-tokens";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import {
  stopSpeaking,
  onSpeakingStateChange,
  createSentenceQueue,
  extractSentences,
} from "@/lib/voice/text-to-speech";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import { CoachFeedItem } from "./coach-feed-item";
import { isMutationAction } from "@/lib/coach/types";
import { executeCoachAction, confirmAction } from "@/lib/coach/action-executor";
import { detectSimpleIntent } from "@/lib/coach/client-intent";
import type {
  CoachMessage,
  CoachContext,
  CoachRequest,
  CoachAction,
  PendingAction,
} from "@/lib/coach/types";

// ── Shared sub-components ────────────────────────────────────────────────────

function GlassCard({
  children,
  style = {},
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${T.glassCard}, ${T.glassElevated})`,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: T.r20,
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let msgIdCounter = 0;
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

type HudState = "idle" | "listening" | "thinking" | "executing";

// ── Quick action presets (context-aware) ─────────────────────────────────────

function getQuickActions(hasActiveWorkout: boolean) {
  if (hasActiveWorkout) {
    return [
      { label: "Log Set", icon: Dumbbell, prompt: "I just did " },
      { label: "Add Exercise", icon: Plus, prompt: "Add " },
      { label: "Swap Move", icon: ArrowRightLeft, prompt: "Swap " },
      { label: "Rest Timer", icon: Timer, prompt: "Start a 90 second timer" },
      { label: "How Am I Doing?", icon: Brain, prompt: "How is my workout looking?" },
    ];
  }
  return [
    { label: "Plan a Workout", icon: Dumbbell, prompt: "Plan a workout for me" },
    { label: "Check Macros", icon: Apple, prompt: "How are my macros?" },
    { label: "My Progress", icon: TrendingUp, prompt: "How is my training going?" },
    { label: "Build Program", icon: CalendarDays, prompt: "Create a program for " },
  ];
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CoachChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  context: CoachContext;
  onOrbStateChange?: (s: OrbState) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CoachChatSheet({
  isOpen,
  onClose,
  initialMessage,
  context,
  onOrbStateChange,
}: CoachChatSheetProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hudState, setHudState] = useState<HudState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pills, setPills] = useState<string[]>([]);
  const [confirmingMsgId, setConfirmingMsgId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("coach-voice-enabled") !== "false";
  });

  const [userId, setUserId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialMessageSentRef = useRef(false);

  const supabase = useSupabase();
  const { isListening, transcript, startListening, stopListening } =
    useVoiceCommands();

  const router = useRouter();
  const workoutStore = useWorkoutStore();
  const timerStore = useTimerStore();

  // ── Fetch userId on mount ────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

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

  // ── Track speaking state from TTS ─────────────────────────────────────

  useEffect(() => {
    onSpeakingStateChange(setIsSpeaking);
    return () => onSpeakingStateChange(null);
  }, []);

  // ── Sync HUD state ────────────────────────────────────────────────────

  useEffect(() => {
    if (isListening) setHudState("listening");
    else if (isSending) setHudState("thinking");
    else if (isSpeaking) setHudState("executing");
    else setHudState("idle");
  }, [isListening, isSending, isSpeaking]);

  // ── Push hudState → orbState up to wrapper ────────────────────────

  useEffect(() => {
    const map = {
      idle: "idle",
      listening: "listening",
      thinking: "thinking",
      executing: "speaking",
    } as const;
    onOrbStateChange?.(map[hudState]);
  }, [hudState, onOrbStateChange]);

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

  // ── Send message (streaming) ─────────────────────────────────────────

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

      // Client-side intent detection — skip API for greetings/thanks/affirmations
      const cannedReply = detectSimpleIntent(text);
      if (cannedReply !== null) {
        if (cannedReply) {
          // Non-empty canned response (greeting/thanks)
          setMessages((prev) => [
            ...prev,
            {
              id: nextMsgId(),
              role: "assistant",
              content: cannedReply,
              timestamp: Date.now(),
            },
          ]);
        }
        // Empty string = silent affirmation — no response needed
        return;
      }

      setIsSending(true);
      setHudState("thinking");

      // Create a placeholder assistant message for streaming
      const assistantMsgId = nextMsgId();
      const assistantMsg: CoachMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Start sentence queue for TTS
      const ttsQueue = voiceEnabled ? createSentenceQueue() : null;
      let sentenceRemainder = "";

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

        // Parse SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullReply = "";
        let streamAction: CoachAction = "none";
        let streamData: Record<string, unknown> | undefined;
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? ""; // keep incomplete line

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));

                if (currentEvent === "text") {
                  fullReply += data.delta;
                  // Update the streaming message content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: fullReply }
                        : m,
                    ),
                  );

                  // Detect sentence boundaries for TTS
                  if (ttsQueue) {
                    sentenceRemainder += data.delta;
                    const [sentences, remainder] =
                      extractSentences(sentenceRemainder);
                    sentenceRemainder = remainder;
                    for (const sentence of sentences) {
                      ttsQueue.push(sentence);
                    }
                  }
                } else if (currentEvent === "action") {
                  streamAction = (data.action ?? "none") as CoachAction;
                  streamData = data.data ?? undefined;
                } else if (currentEvent === "error") {
                  throw new Error(data.error ?? "Stream error");
                }
              } catch (e) {
                if (e instanceof Error && e.message !== "Stream error") {
                  // JSON parse error — skip this event
                }
              }
              currentEvent = "";
            }
          }
        }

        // Flush remaining text as a final sentence for TTS
        if (ttsQueue && sentenceRemainder.trim()) {
          ttsQueue.push(sentenceRemainder.trim());
          ttsQueue.finish();
        }

        // Execute mutation actions
        let actionResult: { success: boolean; message: string } | undefined;
        let pendingAction: PendingAction | undefined;
        if (isMutationAction(streamAction)) {
          setHudState("executing");
          const result = await executeCoachAction(
            streamAction,
            streamData ?? null,
            {
              workout: workoutStore,
              timer: timerStore,
              router,
              userId: userId ?? undefined,
            },
          );

          if (result.pending) {
            // Destructive action — needs user confirmation
            pendingAction = result.pending;
          } else {
            actionResult = result;
            if (result.success && result.message) {
              const pillText = result.message;
              setPills((prev) => [...prev, pillText]);
              setTimeout(
                () => setPills((prev) => prev.filter((x) => x !== pillText)),
                2800,
              );
            }
          }
        }

        // Finalize the assistant message (mark streaming done)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: fullReply,
                  action: streamAction,
                  data: streamData,
                  actionResult,
                  pendingAction,
                  isStreaming: false,
                }
              : m,
          ),
        );
      } catch {
        // Update the placeholder or add error message
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantMsgId);
          if (existing && !existing.content) {
            // Replace empty placeholder with error
            return prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "Connection lost. Try again.", isStreaming: false }
                : m,
            );
          }
          // Had partial content — mark as done
          return prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
          );
        });
        ttsQueue?.cancel();
      } finally {
        setIsSending(false);
        setHudState("idle");
      }
    },
    [messages, context, isSending, workoutStore, timerStore, router, voiceEnabled, userId],
  );

  // ── Confirm / Dismiss pending destructive actions ────────────────────

  const handleConfirmAction = useCallback(
    async (msgId: string, pending: PendingAction) => {
      setConfirmingMsgId(msgId);
      const result = await confirmAction(pending, {
        workout: workoutStore,
        timer: timerStore,
        router,
        userId: userId ?? undefined,
      });

      // Update message: replace pending with actionResult
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, pendingAction: undefined, actionResult: result }
            : m,
        ),
      );

      if (result.success && result.message) {
        const pillText = result.message;
        setPills((prev) => [...prev, pillText]);
        setTimeout(
          () => setPills((prev) => prev.filter((x) => x !== pillText)),
          2800,
        );
      }

      setConfirmingMsgId(null);
    },
    [workoutStore, timerStore, router, userId],
  );

  const handleDismissAction = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, pendingAction: undefined, dismissed: true }
          : m,
      ),
    );
  }, []);

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

  const handleSelectOption = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

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
          pills={pills}
          context={context}
          confirmingMsgId={confirmingMsgId}
          onSubmit={handleSubmit}
          onClose={onClose}
          onMicTap={() => (isListening ? stopListening() : startListening())}
          onToggleVoice={toggleVoice}
          onQuickAction={handleQuickAction}
          onConfirmAction={handleConfirmAction}
          onDismissAction={handleDismissAction}
          onSelectOption={handleSelectOption}
          scrollRef={scrollRef}
          inputRef={inputRef}
        />
      )}
    </AnimatePresence>,
    portalTarget
  );
}

// ── Active Workout Context Card ──────────────────────────────────────────────

function WorkoutContextCard({ context }: { context: CoachContext }) {
  const workout = context.active_workout;
  if (!workout) return null;

  const totalExercises = workout.exercises.length;
  const completedExercises = workout.exercises.filter(
    (ex) => ex.sets_completed === ex.sets_total && ex.sets_total > 0
  ).length;

  return (
    <GlassCard style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
      {/* Session bar */}
      <div
        style={{
          background: `linear-gradient(90deg, ${T.volt}18, transparent)`,
          borderBottom: `1px solid ${T.border1}`,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.volt,
              boxShadow: `0 0 8px ${T.volt}`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.text1,
              fontFamily: T.fontDisplay,
            }}
          >
            {workout.name || "SESSION ACTIVE"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Timer size={11} color={T.text2} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.text2,
              fontVariantNumeric: "tabular-nums",
              fontFamily: T.fontSans,
            }}
          >
            {workout.duration_minutes}m
          </span>
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ padding: "8px 12px" }}>
        {workout.exercises.slice(0, 5).map((ex, i) => {
          const done = ex.sets_completed === ex.sets_total && ex.sets_total > 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 4px",
                borderBottom:
                  i < Math.min(workout.exercises.length, 5) - 1
                    ? `1px solid ${T.border1}`
                    : "none",
              }}
            >
              {/* Completion circle */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `1.5px solid ${done ? T.success : T.border2}`,
                  background: done ? `${T.success}20` : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {done && <Check size={9} color={T.success} />}
              </div>

              {/* Exercise name */}
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  color: done ? T.text2 : T.text1,
                  textDecoration: done ? "line-through" : "none",
                  opacity: done ? 0.6 : 1,
                  fontFamily: T.fontSans,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ex.name}
              </span>

              {/* Set progress */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: done ? T.success : T.text2,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {ex.sets_completed}/{ex.sets_total}
              </span>
            </div>
          );
        })}

        {totalExercises > 5 && (
          <p
            style={{
              fontSize: 10,
              color: T.text2,
              textAlign: "center",
              margin: "6px 0 2px",
              opacity: 0.6,
            }}
          >
            +{totalExercises - 5} more
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 12px 10px" }}>
        <div
          style={{
            height: 3,
            borderRadius: 99,
            background: `${T.border1}`,
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0}%`,
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 99,
              background: `linear-gradient(90deg, ${T.volt}, ${T.success})`,
              boxShadow: `0 0 6px ${T.volt}40`,
            }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

// ── Voice Waveform Card ──────────────────────────────────────────────────────

const WAVEFORM_LABELS: Record<HudState, string> = {
  idle: "Monitoring",
  listening: "Listening\u2026",
  thinking: "Analyzing\u2026",
  executing: "Speaking\u2026",
};

function waveformColor(state: HudState): string {
  switch (state) {
    case "listening":
      return T.sky;
    case "thinking":
      return T.violet;
    case "executing":
      return T.volt;
    default:
      return T.border2;
  }
}

function VoiceWaveformCard({ hudState }: { hudState: HudState }) {
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(4));

  useEffect(() => {
    if (hudState === "listening" || hudState === "executing") {
      const interval = setInterval(() => {
        setWaveHeights(Array(24).fill(0).map(() => Math.random() * 28 + 4));
      }, 120);
      return () => clearInterval(interval);
    } else {
      setWaveHeights(Array(24).fill(4));
    }
  }, [hudState]);

  const color = waveformColor(hudState);
  const isAnimated = hudState === "listening" || hudState === "executing";

  return (
    <GlassCard style={{ padding: "14px 16px", marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          height: 48,
        }}
      >
        {waveHeights.map((h, i) => (
          <motion.div
            key={i}
            animate={{ height: h }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              width: 3,
              borderRadius: 99,
              background: isAnimated
                ? `linear-gradient(to top, ${color}, ${color}60)`
                : color,
            }}
          />
        ))}
      </div>
      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          fontWeight: 700,
          color,
          marginTop: 8,
          marginBottom: 0,
          letterSpacing: "0.06em",
          fontFamily: T.fontSans,
        }}
      >
        {WAVEFORM_LABELS[hudState]}
      </p>
    </GlassCard>
  );
}

// ── Action Confirmation Pills ────────────────────────────────────────────────

function ActionPills({ pills }: { pills: string[] }) {
  if (pills.length === 0) return null;

  return (
    <div style={{ position: "relative", minHeight: 40, marginBottom: 8 }}>
      <AnimatePresence>
        {pills.map((pill) => (
          <motion.div
            key={pill}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              background: `${T.volt}18`,
              border: `1px solid ${T.volt}40`,
              borderRadius: T.rFull,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <CircleCheck size={13} color={T.volt} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.volt,
                fontFamily: T.fontSans,
              }}
            >
              {pill}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
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
  pills,
  context,
  confirmingMsgId,
  onSubmit,
  onClose,
  onMicTap,
  onToggleVoice,
  onQuickAction,
  onConfirmAction,
  onDismissAction,
  onSelectOption,
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
  pills: string[];
  context: CoachContext;
  confirmingMsgId: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onMicTap: () => void;
  onToggleVoice: () => void;
  onQuickAction: (prompt: string) => void;
  onConfirmAction: (msgId: string, pending: PendingAction) => void;
  onDismissAction: (msgId: string) => void;
  onSelectOption: (text: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const hudClass =
    hudState === "thinking"
      ? "hud-sheet-thinking"
      : hudState === "listening"
        ? "hud-sheet-listening"
        : "hud-sheet-idle";

  // Map hudState → orbState for header orb color
  const orbKey: OrbState =
    hudState === "executing"
      ? "speaking"
      : hudState === "thinking"
        ? "thinking"
        : hudState === "listening"
          ? "listening"
          : "idle";
  const orbColor = orbColors[orbKey];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* HUD Sheet — glass surface */}
      <motion.div
        initial={{ y: "100%", opacity: 0.8 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.5 }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className={`fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-0.5rem))] min-h-[50dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl ${hudClass}`}
        style={{
          background: T.glassBg,
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: `1px solid ${T.glassBorder}`,
          borderBottom: "none",
          boxShadow: `0 -8px 32px rgba(0,0,0,0.3), inset 0 1.5px 0 rgba(255,255,255,0.35)`,
        }}
      >
        {/* Drag handle — volt-tinted */}
        <div className="flex justify-center pt-2.5 pb-0">
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              background: `linear-gradient(90deg, transparent, ${T.volt}40, transparent)`,
            }}
          />
        </div>

        {/* ── APEX Header ──────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px 12px",
            borderBottom: `1px solid ${T.volt}15`,
            background: `linear-gradient(180deg, ${T.volt}06, transparent)`,
          }}
        >
          {/* APEX orb indicator — with ambient glow */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* Ambient glow behind orb */}
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${orbColor}25, transparent 70%)`,
                filter: "blur(6px)",
                pointerEvents: "none",
              }}
            />
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 0px ${orbColor}00`,
                  `0 0 16px ${orbColor}50`,
                  `0 0 0px ${orbColor}00`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${orbColor}CC, ${orbColor}60 55%, ${orbColor}18)`,
                border: `1.5px solid ${orbColor}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Brain size={15} color={T.text1} />
            </motion.div>
            {/* Live dot */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: T.volt,
                border: `2px solid ${T.bgBase}`,
                boxShadow: `0 0 8px ${T.volt}`,
              }}
            />
          </div>

          {/* Identity text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 20,
                  fontWeight: 900,
                  color: T.volt,
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                }}
              >
                APEX
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: T.fontSans,
                  fontWeight: 600,
                  color: T.text2,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                AI Fitness Coach
              </span>
            </div>
            <p
              style={{
                fontSize: 11,
                color: T.text2,
                margin: "2px 0 0",
                fontFamily: T.fontSans,
              }}
            >
              {hudState === "thinking"
                ? statusMessages.thinking
                : hudState === "listening"
                  ? statusMessages.listening
                  : hudState === "executing"
                    ? statusMessages.speaking
                    : statusMessages.idle}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Volt accent bar */}
            <div
              style={{
                width: 3,
                height: 28,
                borderRadius: 99,
                background: `linear-gradient(to bottom, ${T.volt}, ${T.voltDim}50)`,
                boxShadow: `0 0 10px ${T.volt}60`,
              }}
            />
            {/* Voice toggle — glass surface */}
            <button
              onClick={onToggleVoice}
              title={voiceEnabled ? "Mute APEX" : "Enable APEX voice"}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: `1px solid ${voiceEnabled ? `${T.volt}40` : T.border2}`,
                background: voiceEnabled ? `${T.volt}15` : T.glassElevated,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {voiceEnabled ? (
                <Volume2 size={14} color={T.volt} style={{ opacity: 0.7 }} />
              ) : (
                <VolumeX size={14} color={T.text2} style={{ opacity: 0.4 }} />
              )}
            </button>
            {/* Close — glass surface */}
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: `1px solid ${T.border2}`,
                background: T.glassElevated,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <X size={14} color={T.text2} style={{ opacity: 0.5 }} />
            </button>
          </div>
        </div>

        {/* Divider with volt glow */}
        <div className="relative h-px mx-5">
          <div
            style={{ position: "absolute", inset: 0, background: `${T.border1}` }}
          />
          {hudState !== "idle" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${T.volt}30, transparent)`,
              }}
            />
          )}
        </div>

        {/* ── HUD Content Area (scrollable) ───────────────────────── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {/* Active Workout Context */}
          <WorkoutContextCard context={context} />

          {/* Voice Waveform */}
          <VoiceWaveformCard hudState={hudState} />

          {/* Action Confirmation Pills */}
          <ActionPills pills={pills} />

          {/* Message Feed or Empty State */}
          {messages.length === 0 ? (
            <EmptyState hudState={hudState} onQuickAction={onQuickAction} hasActiveWorkout={!!context.active_workout} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, i) => (
                <CoachFeedItem
                  key={msg.id}
                  message={msg}
                  isLatest={i === messages.length - 1}
                  index={i}
                  totalCount={messages.length}
                  onConfirmAction={onConfirmAction}
                  onDismissAction={onDismissAction}
                  onSelectOption={onSelectOption}
                  isConfirming={confirmingMsgId === msg.id}
                />
              ))}

              {/* Scan-line thinking indicator — volt tinted */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative h-6 overflow-hidden rounded"
                >
                  <div
                    className="absolute inset-0 h-full w-1/4"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${T.volt}15, transparent)`,
                      animation: "hud-scan 1s linear infinite",
                    }}
                  />
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ── Command Input — glass-styled ───────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${T.glassBorder}`,
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {/* Glass input */}
            <GlassCard
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                borderRadius: T.rFull,
                minHeight: 42,
              }}
            >
              <Brain size={14} color={T.volt} style={{ opacity: 0.7, flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="command..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: T.text1,
                }}
                className="placeholder:text-white/20"
                disabled={isSending}
              />
            </GlassCard>

            {/* Mic button — glass */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onMicTap}
              style={{
                width: 42,
                height: 42,
                borderRadius: T.r12,
                border: `1px solid ${isListening ? `${T.sky}40` : T.border2}`,
                background: isListening
                  ? `${T.sky}15`
                  : `linear-gradient(145deg, ${T.glassCard}, ${T.glassElevated})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {isListening && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: T.r12,
                    border: `1px solid ${T.sky}30`,
                    animation: "hud-glow-pulse 1.5s ease-in-out infinite",
                  }}
                />
              )}
              <Mic
                size={16}
                color={isListening ? T.sky : T.text2}
                style={{ opacity: isListening ? 1 : 0.4 }}
              />
            </motion.button>

            {/* Send button — glass */}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              disabled={!inputValue.trim() || isSending}
              style={{
                width: 42,
                height: 42,
                borderRadius: T.r12,
                border: `1px solid ${inputValue.trim() ? `${T.volt}30` : T.border2}`,
                background: inputValue.trim()
                  ? `${T.volt}20`
                  : `linear-gradient(145deg, ${T.glassCard}, ${T.glassElevated})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputValue.trim() ? "pointer" : "default",
                opacity: inputValue.trim() && !isSending ? 1 : 0.3,
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              <ArrowUp
                size={16}
                color={inputValue.trim() ? T.volt : T.text2}
              />
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
  hasActiveWorkout,
}: {
  hudState: HudState;
  onQuickAction: (prompt: string) => void;
  hasActiveWorkout: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        height: "100%",
        minHeight: 200,
      }}
    >
      {/* Large APEX orb */}
      <div
        style={{
          position: "relative",
          marginBottom: 24,
          width: 80,
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
          }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${T.volt}25 0%, transparent 60%)`,
            }}
          />
        </motion.div>
        <div
          style={{
            position: "relative",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 32%, ${T.volt}CC, ${T.volt}60 55%, ${T.volt}18)`,
            boxShadow: `0 0 24px ${T.volt}40, 0 0 48px ${T.volt}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Brain size={18} color={T.text1} />
        </div>
      </div>

      <p
        style={{
          fontFamily: T.fontDisplay,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.3em",
          color: T.volt,
          opacity: 0.5,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {hudState === "idle" ? "APEX READY" : "APEX INITIALIZING"}
      </p>
      <p
        style={{
          maxWidth: 200,
          fontSize: 11,
          color: T.text2,
          opacity: 0.4,
          marginBottom: 24,
          fontFamily: T.fontSans,
        }}
      >
        Add exercises, log sets, swap movements, and control your workout.
      </p>

      {/* Quick action chips — glass styled */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {getQuickActions(hasActiveWorkout).map((qa) => (
          <motion.button
            key={qa.label}
            whileTap={{ scale: 0.97 }}
            onClick={() => onQuickAction(qa.prompt)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: T.rFull,
              border: `1px solid ${T.border2}`,
              background: T.glassElevated,
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 600,
              color: T.text1,
              cursor: "pointer",
              fontFamily: T.fontSans,
              transition: "all 0.2s",
            }}
          >
            <qa.icon size={12} color={T.volt} style={{ opacity: 0.7 }} />
            {qa.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
