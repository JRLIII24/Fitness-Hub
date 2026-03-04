import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Rest Timer Store — Global Single Active Timer
 *
 * Key features:
 * - Enforces one active timer globally (new timer replaces previous timer)
 * - Uses wall-clock timestamps (`endTime`) instead of intervals for accuracy
 * - Persists to localStorage so timer survives page reloads
 * - Single interval loop updates timer progress
 * - Haptic feedback + browser notifications when timer expires
 * - No non-serializable `intervalId` stored in state
 */

export interface Timer {
  id: string; // UUID
  exerciseId: string;
  exerciseName: string;
  totalSeconds: number;
  endTime: number; // Wall-clock timestamp when timer ends
  isRunning: boolean;
}

interface TimerState {
  timers: Timer[];
  lastTickMs: number; // Timestamp of last tick (triggers React re-renders)
  notificationPermission: NotificationPermission | null;

  startTimer: (exerciseId: string, exerciseName: string, seconds: number) => string;
  pauseTimer: (timerId: string) => void;
  resumeTimer: (timerId: string) => void;
  stopTimer: (timerId: string) => void;
  adjustTime: (timerId: string, delta: number) => void;
  getRemainingSeconds: (timerId: string) => number;
  getActiveTimers: () => Timer[];
  requestNotificationPermission: () => Promise<void>;
}

function pickSingleMostRecentTimer(timers: Timer[]): Timer[] {
  if (timers.length <= 1) return timers;
  const mostRecent = timers.reduce((latest, current) =>
    current.endTime > latest.endTime ? current : latest
  );
  return [mostRecent];
}

// Module-level interval ID (not persisted — cleaned up on unmount)
// Removed - now using intervalId declared in startAnimationLoop

// Guard flag: ensures the visibilitychange listener is registered exactly once
// per page load regardless of how many times onRehydrateStorage fires.
let visibilityListenerAttached = false;

// Generate unique timer ID
function generateTimerId(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --------------------------------------------------------------------------
// Audio helpers — singleton AudioContext pattern
//
// iOS Safari requires a user gesture to unlock AudioContext. Creating a new
// context on every beep (old approach) always fails because beeps fire when
// the timer expires — never during a gesture. The fix:
//   1. Create/reuse a single AudioContext instance.
//   2. Call unlockAudioContext() inside startTimer() — that runs during the
//      user's tap, which is a trusted gesture context on iOS.
//   3. By the time the timer expires, ctx.state === 'running' and the beep
//      plays normally.
//   4. If audio is still unavailable (denied, SSR, old browser), dispatch
//      a DOM event so the UI can show a visible fallback toast.
// --------------------------------------------------------------------------

/** Module-level singleton — expensive to create; safe to reuse across timers. */
let _audioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new AudioContext();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

/**
 * Call during a user-gesture (e.g. the tap that starts a timer) to unlock
 * the AudioContext on iOS Safari. ctx.resume() only works synchronously
 * inside a trusted interaction event.
 */
function unlockAudioContext(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[timer-store] AudioContext.resume() failed — audio will be silent on iOS Safari"
        );
      }
    });
  }
}

/**
 * Plays a short 880 Hz beep.
 *
 * Returns true if audio played. Returns false (and dispatches
 * 'rest-timer-complete' CustomEvent) when the context is not running —
 * e.g. iOS Safari before gesture unlock, or browsers with no Web Audio API.
 * The workout page listens for that event and shows a toast fallback.
 */
function playBeep(exerciseName: string): boolean {
  const ctx = getOrCreateAudioContext();

  if (!ctx || ctx.state !== "running") {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[timer-store] Audio unavailable (state: ${ctx?.state ?? "null"}) for "${exerciseName}" — dispatching fallback event`
      );
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rest-timer-complete", { detail: { exerciseName } })
      );
    }
    return false;
  }

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880; // A5 note
    gain.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => {
      try {
        oscillator.stop();
      } catch {
        /* context may have been suspended/closed since we started */
      }
    }, 300);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[timer-store] playBeep oscillator error:", err);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rest-timer-complete", { detail: { exerciseName } })
      );
    }
    return false;
  }
}

// Haptic feedback helper
function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(200); // 200ms vibration
    }
  } catch {
    // Vibration not available
  }
}

// Browser notification helper
function showNotification(exerciseName: string) {
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Rest Timer Complete", {
        body: `${exerciseName} rest period finished!`,
        icon: "/icon-192.png", // Optional: add app icon
        badge: "/icon-192.png",
        tag: "rest-timer", // Replace previous notifications
        requireInteraction: false,
      });
    }
  } catch {
    // Notifications not available
  }
}

// Animation loop (runs when any timer is active)
// Uses 100ms interval for smooth second-by-second updates
let intervalId: ReturnType<typeof setInterval> | null = null;

function startAnimationLoop(get: () => TimerState, set: (partial: Partial<TimerState>) => void) {
  function tick() {
    const state = get();
    const activeTimers = state.timers.filter((t) => t.isRunning);

    if (activeTimers.length === 0) {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    const now = Date.now();
    const updatedTimers = state.timers.map((timer) => {
      if (!timer.isRunning) return timer;

      const remaining = Math.max(0, Math.ceil((timer.endTime - now) / 1000));

      // Timer expired
      if (remaining === 0) {
        playBeep(timer.exerciseName); // passes name for fallback event on iOS
        triggerHaptic();
        showNotification(timer.exerciseName);
        import("@/lib/native/live-activity").then((m) => m.stopRestTimerActivity()).catch(() => {});
        import("@/lib/native/android-timer-notification").then((m) => m.cancelAndroidTimerNotification()).catch(() => {});
        return { ...timer, isRunning: false };
      }

      return timer;
    });

    // Remove expired timers that are no longer running
    const filteredTimers = updatedTimers.filter((t) => t.isRunning || t.endTime > now);

    // Update lastTickMs to trigger React re-renders
    set({ timers: filteredTimers, lastTickMs: now });

    // Check if we should continue
    if (filteredTimers.length === 0 || !filteredTimers.some((t) => t.isRunning)) {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }

  // Clear existing interval
  if (intervalId !== null) {
    clearInterval(intervalId);
  }

  // Start new interval at 1000ms (1 hz per LOG-01 req)
  intervalId = setInterval(tick, 1000);

  // Run immediately
  tick();
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],
      lastTickMs: 0,
      notificationPermission: typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : null,

      startTimer: (exerciseId: string, exerciseName: string, seconds: number) => {
        // Unlock AudioContext now — this call happens inside the user's tap
        // gesture, which is the only context iOS Safari trusts for audio unlock.
        unlockAudioContext();

        const timerId = generateTimerId();
        const endTime = Date.now() + seconds * 1000;

        const newTimer: Timer = {
          id: timerId,
          exerciseId,
          exerciseName,
          totalSeconds: seconds,
          endTime,
          isRunning: true,
        };

        // Fire-and-forget native timer (iOS Live Activity / Android notification)
        import("@/lib/native/live-activity").then((m) =>
          m.startRestTimerActivity(exerciseName, endTime)
        ).catch(() => {});
        import("@/lib/native/android-timer-notification").then((m) =>
          m.showAndroidTimerNotification(exerciseName, seconds)
        ).catch(() => {});

        // Global timer rule: starting a timer clears/replaces any existing timers.
        set(() => ({
          timers: [newTimer],
          lastTickMs: Date.now(),
        }));

        startAnimationLoop(get, set);
        return timerId;
      },

      pauseTimer: (timerId: string) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === timerId ? { ...t, isRunning: false } : t
          ),
        }));
      },

      resumeTimer: (timerId: string) => {
        const state = get();
        const timer = state.timers.find((t) => t.id === timerId);
        if (!timer || timer.endTime <= Date.now()) return;

        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === timerId ? { ...t, isRunning: true } : t
          ),
        }));

        startAnimationLoop(get, set);
      },

      stopTimer: (timerId: string) => {
        import("@/lib/native/live-activity").then((m) => m.stopRestTimerActivity()).catch(() => {});
        import("@/lib/native/android-timer-notification").then((m) => m.cancelAndroidTimerNotification()).catch(() => {});
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== timerId),
        }));
      },

      adjustTime: (timerId: string, delta: number) => {
        const now = Date.now();
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === timerId
              ? { ...t, endTime: Math.max(now, t.endTime + delta * 1000) }
              : t
          ),
        }));
      },

      getRemainingSeconds: (timerId: string) => {
        const state = get();
        const timer = state.timers.find((t) => t.id === timerId);
        if (!timer) return 0;
        return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
      },

      getActiveTimers: () => {
        const state = get();
        const now = Date.now();
        const activeTimers = state.timers.filter((t) => t.isRunning || t.endTime > now);
        return pickSingleMostRecentTimer(activeTimers);
      },

      requestNotificationPermission: async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          set({ notificationPermission: permission });
        }
      },
    }),
    {
      name: "rest-timer-storage",
      partialize: (state) => ({
        // Only persist timers, not lastTickMs or notificationPermission (ephemeral)
        timers: pickSingleMostRecentTimer(state.timers),
      }),
      onRehydrateStorage: () => (state) => {
        // Resume animation loop if any timers were running before reload
        if (state && state.timers.length > 0) {
          const now = Date.now();

          // Filter out expired timers and resume active ones
          const validTimers = state.timers.filter((t) => t.endTime > now);
          const singleTimer = pickSingleMostRecentTimer(validTimers);

          if (singleTimer.length > 0) {
            useTimerStore.setState({ timers: singleTimer });

            if (singleTimer.some((t) => t.isRunning)) {
              startAnimationLoop(useTimerStore.getState, useTimerStore.setState);
            }
          } else {
            useTimerStore.setState({ timers: [] });
          }
        }

        // Restore notification permission
        if (typeof window !== "undefined" && "Notification" in window) {
          useTimerStore.setState({ notificationPermission: Notification.permission });
        }

        // Attach once — onRehydrateStorage can fire on every page load/navigation.
        // Without this guard, listeners stack and the handler executes N times
        // per visibilitychange event after N page visits.
        if (typeof window !== "undefined" && !visibilityListenerAttached) {
          visibilityListenerAttached = true;
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              const currentStore = useTimerStore.getState();
              const validTimers = currentStore.timers.filter((t) => t.endTime > Date.now());
              if (validTimers.some((t) => t.isRunning)) {
                startAnimationLoop(useTimerStore.getState, useTimerStore.setState);
              }
            }
          });
        }
      },
    }
  )
);
