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
