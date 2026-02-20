/**
 * Celebration Utilities — Confetti, Haptics, Sounds
 *
 * Centralized celebration system for achievement moments:
 * - Workout complete
 * - PR achieved
 * - Streak milestones
 * - Goal completion
 */

import confetti from "canvas-confetti";

/**
 * Haptic feedback helper (mobile vibration)
 */
export function triggerHaptic(pattern: "light" | "medium" | "heavy" = "medium") {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

    const patterns = {
      light: [10],
      medium: [50],
      heavy: [10, 50, 10], // short-long-short
    };

    navigator.vibrate(patterns[pattern]);
  } catch {
    // Vibration not available
  }
}

/**
 * Audio beep helper (lightweight success sound)
 */
export function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    // Happy chord: C major (523Hz)
    oscillator.frequency.value = 523;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);

    setTimeout(() => ctx.close(), 400);
  } catch {
    // Audio not available
  }
}

/**
 * Confetti burst — Standard celebration
 */
export function fireConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#4D9FFF", "#FCD34D", "#F472B6", "#34D399"], // Brand colors
  });
}

/**
 * Confetti cannon — Big achievement
 */
export function fireConfettiCannon() {
  const duration = 2000;
  const animationEnd = Date.now() + duration;
  const defaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0,
    colors: ["#4D9FFF", "#FCD34D", "#F472B6", "#34D399", "#FB923C"],
  };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

/**
 * Golden confetti — PR achievement
 */
export function fireGoldenConfetti() {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.5 },
    colors: ["#FCD34D", "#F59E0B", "#FBBF24", "#FDE68A"], // Gold gradient
    shapes: ["circle", "square"],
    scalar: 1.2, // Bigger particles
  });
}

/**
 * Streak confetti — Fire theme
 */
export function fireStreakConfetti(streakCount: number) {
  // Intensity scales with streak milestone
  const intensity = streakCount >= 100 ? 150 : streakCount >= 30 ? 120 : 100;

  confetti({
    particleCount: intensity,
    spread: 100,
    origin: { y: 0.55 },
    colors: ["#FB923C", "#EF4444", "#F59E0B", "#FBBF24"], // Fire gradient
    startVelocity: 35,
    gravity: 1.2,
  });
}

/**
 * Complete workout celebration — Multi-stage
 *
 * Stage 1: Confetti burst (instant)
 * Stage 2: Haptic feedback (50ms delay)
 * Stage 3: Success sound (100ms delay)
 */
export function celebrateWorkoutComplete(hadPRs: boolean = false) {
  // Stage 1: Confetti
  if (hadPRs) {
    fireGoldenConfetti();
  } else {
    fireConfetti();
  }

  // Stage 2: Haptic (50ms delay for tactile feedback)
  setTimeout(() => {
    triggerHaptic(hadPRs ? "heavy" : "medium");
  }, 50);

  // Stage 3: Sound (100ms delay for audio-visual sync)
  setTimeout(() => {
    playSuccessSound();
  }, 100);
}

/**
 * Celebrate PR achievement — Immediate gold burst
 */
export function celebratePR() {
  fireGoldenConfetti();
  triggerHaptic("heavy");
  playSuccessSound();
}

/**
 * Celebrate streak milestone
 */
export function celebrateStreak(streakCount: number) {
  fireStreakConfetti(streakCount);
  triggerHaptic(streakCount >= 30 ? "heavy" : "medium");

  // Different sound pitch based on milestone
  if (streakCount >= 100) {
    playSuccessSound(); // Higher pitched for big milestones
  } else if (streakCount >= 30) {
    playSuccessSound();
  } else if (streakCount >= 7) {
    playSuccessSound();
  }
}

/**
 * Celebrate macro goal hit
 */
export function celebrateMacroGoal() {
  confetti({
    particleCount: 60,
    spread: 50,
    origin: { y: 0.7 },
    colors: ["#60A5FA", "#FCD34D", "#F472B6", "#4ADE80"], // Macro colors
    startVelocity: 25,
  });
  triggerHaptic("light");
}
