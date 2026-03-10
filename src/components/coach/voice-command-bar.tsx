"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Check, X } from "lucide-react";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { VOICE_LOGGING_ENABLED } from "@/lib/features";
import { weightToDisplay, lbsToKg } from "@/lib/units";
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
                  ? lbsToKg(setData.weight)
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
