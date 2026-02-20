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

// Generate unique timer ID
function generateTimerId(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Audio beep helper
function playBeep() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880; // A5 note
    gain.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 300);
  } catch {
    // Audio not available
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
        playBeep();
        triggerHaptic();
        showNotification(timer.exerciseName);
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

  // Start new interval at 100ms (10 updates per second for smooth countdown)
  intervalId = setInterval(tick, 100);

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
            state.timers = singleTimer;

            if (singleTimer.some((t) => t.isRunning)) {
              startAnimationLoop(() => state as TimerState, (partial) => {
                Object.assign(state, partial);
              });
            }
          } else {
            state.timers = [];
          }
        }

        // Restore notification permission
        if (state && typeof window !== "undefined" && "Notification" in window) {
          state.notificationPermission = Notification.permission;
        }
      },
    }
  )
);
