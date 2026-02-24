"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTimerStore, type Timer } from "@/stores/timer-store";
import { Pause, Play, X, Plus, Minus, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── PillButton ───────────────────────────────────────────────────────────────

function PillButton({
  onClick,
  "aria-label": ariaLabel,
  children,
}: {
  onClick: () => void;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-7 items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </motion.button>
  );
}

// ─── SingleTimerPill ─────────────────────────────────────────────────────────

function SingleTimerPill({ timer, index }: { timer: Timer; index: number }) {
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const adjustTime = useTimerStore((s) => s.adjustTime);

  // Subscribe directly so we always get the latest state
  const liveTimer = useTimerStore((s) => s.timers.find((t) => t.id === timer.id));
  const lastTickMs = useTimerStore((s) => s.lastTickMs);

  const [isExpanded, setIsExpanded] = useState(false);

  const remainingSeconds = liveTimer
    ? Math.max(
      0,
      Math.ceil((liveTimer.endTime - (lastTickMs || liveTimer.endTime - liveTimer.totalSeconds * 1000)) / 1000)
    )
    : 0;

  // Auto-remove when countdown reaches zero
  useEffect(() => {
    if (!liveTimer || remainingSeconds > 0) return;
    stopTimer(timer.id);
    queueMicrotask(() => {
      setIsExpanded(false);
    });
  }, [liveTimer, remainingSeconds, stopTimer, timer.id]);

  const progress =
    liveTimer && liveTimer.totalSeconds > 0
      ? Math.min(1, (liveTimer.totalSeconds - remainingSeconds) / liveTimer.totalSeconds)
      : 0;

  // Clock geometry — 56 px ring
  const SIZE = 56;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = 21;
  const circumference = 2 * Math.PI * r;
  const sweepAngle = progress * 360;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Urgency color shifts as time runs out — uses app theme tokens
  const urgencyClass =
    remainingSeconds <= 10
      ? "text-destructive"
      : remainingSeconds <= 30
        ? "text-amber-400"
        : "text-primary";

  const isRunning = liveTimer?.isRunning ?? timer.isRunning;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34, delay: index * 0.06 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-lg",
        isRunning ? "border-primary/20" : "border-border/60"
      )}
    >
      {/* Running pulse strip at top */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 top-0 h-0.5 rounded-t-2xl"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Compact pill row */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        aria-label={isExpanded ? "Collapse timer controls" : "Expand timer controls"}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-opacity hover:opacity-90"
      >
        {/* Clock ring */}
        <div
          className={cn("relative shrink-0", urgencyClass)}
          style={{ width: SIZE, height: SIZE }}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Tick marks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const isMajor = i % 3 === 0;
              return (
                <line
                  key={`tick-${timer.id}-${i}`}
                  x1={cx + Math.cos(angle) * (isMajor ? 24 : 25)}
                  y1={cy + Math.sin(angle) * (isMajor ? 24 : 25)}
                  x2={cx + Math.cos(angle) * 27}
                  y2={cy + Math.sin(angle) * 27}
                  stroke={
                    isMajor ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"
                  }
                  strokeWidth={isMajor ? 1.5 : 1}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Track */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              opacity={0.12}
            />

            {/* Progress arc */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{
                transition:
                  "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), opacity 0.3s",
              }}
            />

            {/* Sweep hand */}
            <g
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: `rotate(${sweepAngle}deg)`,
                transition: "transform 0.9s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <line
                x1={cx}
                y1={cy}
                x2={cx + r - 4}
                y2={cy}
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.9}
              />
            </g>

            {/* Center dot */}
            <circle cx={cx} cy={cy} r={2} fill="currentColor" />
          </svg>

          {/* Small time inside ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold tabular-nums text-foreground">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Name + status */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {timer.exerciseName}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isRunning ? "Resting…" : "Paused"}
          </p>
        </div>

        {/* Large time readout — right side */}
        <div className="shrink-0 text-right">
          <span
            className={cn(
              "block tabular-nums text-[26px] font-black leading-none tracking-tight transition-colors duration-300",
              urgencyClass
            )}
          >
            {formatTime(remainingSeconds)}
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {isExpanded ? "tap to collapse" : "tap to control"}
          </span>
        </div>
      </button>

      {/* Expanded controls */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3.5 py-3">
              {/* ±15s pill buttons */}
              <div className="flex items-center gap-1.5">
                <PillButton
                  onClick={() => adjustTime(timer.id, -15)}
                  aria-label="Subtract 15 seconds"
                >
                  <Minus className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">15s</span>
                </PillButton>
                <PillButton
                  onClick={() => adjustTime(timer.id, 15)}
                  aria-label="Add 15 seconds"
                >
                  <Plus className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">15s</span>
                </PillButton>
              </div>

              {/* Play/Pause + Stop circular buttons */}
              <div className="flex items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() =>
                    isRunning ? pauseTimer(timer.id) : resumeTimer(timer.id)
                  }
                  aria-label={isRunning ? "Pause timer" : "Resume timer"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    isRunning
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/60 text-foreground"
                  )}
                >
                  {isRunning ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    stopTimer(timer.id);
                    setIsExpanded(false);
                  }}
                  aria-label="Stop timer"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── RestTimerPill ────────────────────────────────────────────────────────────

interface RestTimerPillProps {
  className?: string;
}

export function RestTimerPill({ className }: RestTimerPillProps) {
  const getActiveTimers = useTimerStore((s) => s.getActiveTimers);
  const notificationPermission = useTimerStore((s) => s.notificationPermission);
  const requestNotificationPermission = useTimerStore(
    (s) => s.requestNotificationPermission
  );

  // Subscribe to lastTickMs so container re-renders and passes fresh timer objects
  const lastTickMs = useTimerStore((s) => s.lastTickMs);
  void lastTickMs;

  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  const activeTimers = getActiveTimers();

  useEffect(() => {
    if (!mounted) return;
    if (
      !hasRequestedPermission &&
      activeTimers.length > 0 &&
      notificationPermission === "default"
    ) {
      requestNotificationPermission();
      queueMicrotask(() => {
        setHasRequestedPermission(true);
      });
    }
  }, [
    mounted,
    activeTimers.length,
    hasRequestedPermission,
    notificationPermission,
    requestNotificationPermission,
  ]);

  if (!mounted || activeTimers.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 z-[90] flex w-[calc(100%-1rem)] max-w-sm -translate-x-1/2 flex-col gap-2",
        "bottom-[calc(env(safe-area-inset-bottom)+6rem)] md:bottom-8",
        "max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain",
        className
      )}
    >
      {/* Notification denied banner */}
      <AnimatePresence>
        {notificationPermission === "denied" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3.5 py-2.5"
          >
            <BellOff className="h-3 w-3 shrink-0 text-amber-400" />
            <span className="text-[11px] leading-snug text-muted-foreground">
              Notifications blocked — enable in browser settings for timer alerts.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer pills */}
      <AnimatePresence mode="popLayout">
        {activeTimers.map((timer, index) => (
          <div key={timer.id} className="pointer-events-auto">
            <SingleTimerPill timer={timer} index={index} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
