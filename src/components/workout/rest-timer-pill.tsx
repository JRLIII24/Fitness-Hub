"use client";

import { useState, useEffect } from "react";
import { useTimerStore, type Timer } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { Pause, Play, X, Plus, Minus, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SingleTimerPillProps {
  timer: Timer;
  onExpand?: () => void;
}

/**
 * SingleTimerPill — Individual timer pill component
 */
function SingleTimerPill({ timer, onExpand }: SingleTimerPillProps) {
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resumeTimer = useTimerStore((state) => state.resumeTimer);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const adjustTime = useTimerStore((state) => state.adjustTime);

  // Subscribe to the actual timer from the store to get live updates
  const liveTimer = useTimerStore((state) =>
    state.timers.find((t) => t.id === timer.id)
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [, forceUpdate] = useState(0);

  // Force re-render every 100ms to update countdown display
  useEffect(() => {
    if (!liveTimer || !liveTimer.isRunning) return;

    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [liveTimer?.isRunning]);

  // Calculate remaining seconds from wall-clock time (always current)
  const remainingSeconds = liveTimer
    ? Math.max(0, Math.ceil((liveTimer.endTime - Date.now()) / 1000))
    : 0;

  // Hard guarantee: once timer hits 0, remove it from UI/store immediately.
  useEffect(() => {
    if (!liveTimer) return;
    if (remainingSeconds > 0) return;
    stopTimer(timer.id);
    setIsExpanded(false);
  }, [liveTimer, remainingSeconds, stopTimer, timer.id]);

  const progress =
    liveTimer && liveTimer.totalSeconds > 0
      ? ((liveTimer.totalSeconds - remainingSeconds) / liveTimer.totalSeconds) * 100
      : 0;
  const sweepAngle = (progress / 100) * 360;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    onExpand?.();
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm transition-all duration-300",
        isExpanded ? "p-3" : "p-2",
        timer.isRunning && "animate-[timer-breathe_2200ms_cubic-bezier(0.22,1,0.36,1)_infinite]"
      )}
    >
      {/* Compact Pill */}
      <button
        onClick={handleToggleExpand}
        aria-label={isExpanded ? "Collapse timer controls" : "Expand timer controls"}
        className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
      >
        {/* Clock-style Progress Ring */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg className="absolute inset-0" width="48" height="48" viewBox="0 0 48 48">
            {/* Tick marks */}
            <g className="text-muted-foreground/45">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * 360;
                const rad = (angle * Math.PI) / 180;
                const x1 = 24 + Math.cos(rad) * 18;
                const y1 = 24 + Math.sin(rad) * 18;
                const x2 = 24 + Math.cos(rad) * 20;
                const y2 = 24 + Math.sin(rad) * 20;
                return (
                  <line
                    key={`tick-${timer.id}-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    strokeWidth={i % 3 === 0 ? 1.4 : 1}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            <circle
              cx="24"
              cy="24"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-secondary/75"
            />
            <circle
              cx="24"
              cy="24"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 17}`}
              strokeDashoffset={`${2 * Math.PI * 17 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="text-primary transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />

            {/* Sweep hand */}
            <g
              className="origin-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `rotate(${sweepAngle - 90}deg)`, transformOrigin: "24px 24px" }}
            >
              <line
                x1="24"
                y1="24"
                x2="39"
                y2="24"
                stroke="currentColor"
                strokeWidth="1.3"
                className="text-primary/90"
                strokeLinecap="round"
              />
            </g>
            <circle cx="24" cy="24" r="1.9" className="fill-primary" />
          </svg>
          <span className="text-[10px] font-bold tabular-nums text-foreground">
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {/* Exercise Name + Rest Label */}
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium text-foreground">{timer.exerciseName}</p>
          <p className="text-xs text-muted-foreground">Rest timer</p>
        </div>

        {/* Status Indicator */}
        <div
          className={cn(
            "h-2 w-2 shrink-0 rounded-full transition-colors",
            timer.isRunning ? "bg-primary" : "bg-muted-foreground"
          )}
        />
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => adjustTime(timer.id, -15)}
              title="Remove 15 seconds"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => adjustTime(timer.id, 15)}
              title="Add 15 seconds"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={timer.isRunning ? () => pauseTimer(timer.id) : () => resumeTimer(timer.id)}
              title={timer.isRunning ? "Pause" : "Resume"}
            >
              {timer.isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => {
                stopTimer(timer.id);
                setIsExpanded(false);
              }}
              title="Stop timer"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RestTimerPill — Container for multiple simultaneous timer pills
 *
 * Features:
 * - Displays all active timers as stacked pills
 * - Haptic feedback when timer expires
 * - Browser notifications (with permission)
 * - Auto-dismisses expired timers
 */
interface RestTimerPillProps {
  className?: string;
}

export function RestTimerPill({ className }: RestTimerPillProps) {
  const getActiveTimers = useTimerStore((state) => state.getActiveTimers);
  const notificationPermission = useTimerStore((state) => state.notificationPermission);
  const requestNotificationPermission = useTimerStore((state) => state.requestNotificationPermission);

  // Subscribe to lastTickMs to force re-renders when timers update
  const lastTickMs = useTimerStore((state) => state.lastTickMs);
  void lastTickMs;

  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTimers = getActiveTimers();

  // Request notification permission on first timer.
  // Must be declared before any conditional returns to preserve hook order.
  useEffect(() => {
    if (!mounted) return;
    if (
      !hasRequestedPermission &&
      activeTimers.length > 0 &&
      notificationPermission === "default"
    ) {
      requestNotificationPermission();
      setHasRequestedPermission(true);
    }
  }, [
    mounted,
    activeTimers.length,
    hasRequestedPermission,
    notificationPermission,
    requestNotificationPermission,
  ]);

  // Don't render until mounted to avoid hydration mismatch with persisted store
  if (!mounted) {
    return null;
  }

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed left-1/2 z-[70] w-[calc(100%-1rem)] max-w-sm -translate-x-1/2",
        "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6",
        "max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain",
        className
      )}
    >
      {/* Notification Permission Banner (if denied) */}
      {notificationPermission === "denied" && (
        <div className="pointer-events-auto mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <BellOff className="h-3 w-3 shrink-0" />
          <span>Notifications blocked. Enable in browser settings for timer alerts.</span>
        </div>
      )}

      {/* Active Timer Pills (stacked) */}
      {activeTimers.map((timer) => (
        <div key={timer.id} className="pointer-events-auto mb-2">
          <SingleTimerPill timer={timer} />
        </div>
      ))}
    </div>
  );
}
