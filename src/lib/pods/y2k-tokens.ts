/**
 * Y2K / Retro-Future Design Tokens — Accountability Pods
 * Chrome gradients, iridescent accents, bubbly rounded shapes.
 * Glass-morphism native — works with the existing glass surface system.
 *
 * Tailwind is used for layout (flex, grid, gap).
 * Inline styles via Y2K tokens for visual identity.
 */

import type { MemberProgress, ArenaTier } from "@/types/pods";

// ── Token object ────────────────────────────────────────────────────────────────

export const Y2K = {
  // ── Surfaces (glass-compatible) ───────────────────────────
  bg0: "rgba(8,6,24,1)",              // Deep purple-black backdrop
  bg1: "rgba(12,10,30,0.88)",         // Standard panel
  bg2: "rgba(10,8,28,0.96)",          // Hero panel
  bg3: "rgba(20,18,40,0.90)",         // Inner cell

  // ── Borders ─────────────────────────────────────────────
  border1: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.14)",
  borderAcc: "rgba(255,255,255,0.20)",

  // ── Cyan (primary action color — replaces volt) ───────────
  cyan: "#00D4FF",
  cyanDim: "rgba(0,212,255,0.60)",
  cyanBg: "rgba(0,212,255,0.08)",
  cyanBorder: "rgba(0,212,255,0.25)",
  cyanGlow: "0 0 24px rgba(0,212,255,0.30)",

  // ── Secondary accents ─────────────────────────────────────
  lavender: "#B794F6",
  hotPink: "#FF6BCA",
  iridescent: "linear-gradient(135deg, #FF6BCA, #B794F6, #00D4FF)",

  // ── Tier colors (DB stores bronze/silver/gold/platinum) ───
  div: {
    bronze: {
      fg: "#A8A29E",
      bg: "rgba(168,162,158,0.10)",
      border: "rgba(168,162,158,0.25)",
      glow: "0 0 20px rgba(168,162,158,0.20)",
    },
    silver: {
      fg: "#7DD3FC",
      bg: "rgba(125,211,252,0.08)",
      border: "rgba(125,211,252,0.25)",
      glow: "0 0 20px rgba(125,211,252,0.22)",
    },
    gold: {
      fg: "#C084FC",
      bg: "rgba(192,132,252,0.10)",
      border: "rgba(192,132,252,0.30)",
      glow: "0 0 24px rgba(192,132,252,0.30)",
    },
    platinum: {
      fg: "#FF6BCA",
      bg: "rgba(255,107,202,0.10)",
      border: "rgba(255,107,202,0.30)",
      glow: "0 0 32px rgba(255,107,202,0.35)",
    },
  },

  // ── Player status ─────────────────────────────────────────
  status: {
    active: {
      fg: "#34D399",
      bg: "rgba(52,211,153,0.10)",
      border: "rgba(52,211,153,0.25)",
      label: "VIBING" as const,
      icon: "sparkles" as const,
    },
    warning: {
      fg: "#FBBF24",
      bg: "rgba(251,191,36,0.10)",
      border: "rgba(251,191,36,0.25)",
      label: "SLIPPING" as const,
      icon: "clock" as const,
    },
    critical: {
      fg: "#FB7185",
      bg: "rgba(251,113,133,0.10)",
      border: "rgba(251,113,133,0.25)",
      label: "GHOSTING" as const,
      icon: "ghost" as const,
    },
    clutch: {
      fg: "#00D4FF",
      bg: "rgba(0,212,255,0.10)",
      border: "rgba(0,212,255,0.25)",
      label: "CLUTCH" as const,
      icon: "zap" as const,
    },
    training: {
      fg: "#00D4FF",
      bg: "rgba(0,212,255,0.10)",
      border: "rgba(0,212,255,0.25)",
      label: "TRAINING" as const,
      icon: "dumbbell" as const,
    },
  },

  // ── Rank colors (leaderboard) ───────────────────────────
  rank: {
    1: "#C084FC",   // Purple (Epic)
    2: "#7DD3FC",   // Sky Blue (Rare)
    3: "#A8A29E",   // Warm Gray (Basic)
  } as Record<number, string>,

  // ── Pressure labels ─────────────────────────────────────
  pressure: {
    inSync:   { fg: "#00D4FF", label: "IN SYNC" },
    cruising: { fg: "#34D399", label: "CRUISING" },
    drifting: { fg: "#FBBF24", label: "DRIFTING" },
    offline:  { fg: "#FB7185", label: "OFFLINE" },
  },

  // ── Text ────────────────────────────────────────────────
  text1: "rgba(255,255,255,0.95)",
  text2: "rgba(255,255,255,0.55)",
  text3: "rgba(255,255,255,0.32)",

  // ── Border radii (bubbly, rounded) ─────────────────────
  r8: "8px",
  r12: "12px",
  r16: "16px",
  rFull: "9999px",

  // ── Typography ──────────────────────────────────────────
  fontDisplay: "'Space Grotesk', system-ui, sans-serif",
  fontSans: "'Inter', system-ui, sans-serif",

  // ── Star-field grid overlay ────────────────────────────
  gridBg: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`,
  gridSize: "32px 32px",

  // ── Motion presets ──────────────────────────────────────
  spring: { type: "spring" as const, stiffness: 340, damping: 36, mass: 0.8 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 34 },
  stagger: 0.06,
} as const;

// ── Tier display names (DB stores bronze/silver/gold/platinum) ────────────────

const TIER_LABELS: Record<ArenaTier, string> = {
  bronze: "Basic",
  silver: "Rare",
  gold: "Epic",
  platinum: "Legendary",
};

export function tierLabel(tier: ArenaTier): string {
  return TIER_LABELS[tier];
}

// ── Type exports ──────────────────────────────────────────────────────────────

export type PlayerStatus = keyof typeof Y2K.status;
export type TierConfig = (typeof Y2K.div)[ArenaTier];

// ── Helper functions ──────────────────────────────────────────────────────────

/** Get Y2K tier config for an arena tier */
export function tierCfg(tier: ArenaTier): TierConfig {
  return Y2K.div[tier];
}

/** Get Y2K status config for a player status */
export function statusCfg(status: PlayerStatus) {
  return Y2K.status[status];
}

/** Derive player status from MemberProgress */
export function getPlayerStatus(progress: MemberProgress): PlayerStatus {
  const { completed, commitment, is_on_track, preferred_workout_days, planned_days, completed_days } = progress;

  if (commitment === 0) return "warning";
  if (is_on_track) return "active";
  if (completed > 0 && commitment - completed === 1) return "clutch";

  const now = new Date();
  const dayOfWeek = now.getDay();
  const sessionsNeeded = commitment - completed;

  const dayNameToDow: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };
  const dowToDayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // Build the effective list of expected training days this week
  // Priority: planned_days (from commitment) > preferred_workout_days (from profile schedule)
  let expectedDays: string[] = [];
  if (planned_days && planned_days.length > 0) {
    expectedDays = planned_days;
  } else if (preferred_workout_days && preferred_workout_days.length > 0) {
    expectedDays = preferred_workout_days.map(d => dowToDayName[d]).filter(Boolean);
  }

  if (expectedDays.length > 0) {
    // Count how many expected training days have passed WITHOUT a workout
    const missedDays = expectedDays.filter(d => {
      const dow = dayNameToDow[d];
      if (dow === undefined) return false;
      const dayIdx = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6
      const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return dayIdx < todayIdx && !completed_days.includes(d);
    });

    // If no expected days have been missed, user is on pace — just BEHIND not SLIPPING
    if (missedDays.length === 0) return "warning";

    // Count remaining expected training days (today or later)
    const remainingDays = expectedDays.filter(d => {
      const dow = dayNameToDow[d];
      if (dow === undefined) return false;
      const dayIdx = dow === 0 ? 6 : dow - 1;
      const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return dayIdx >= todayIdx;
    });

    if (sessionsNeeded > remainingDays.length) return "critical";
    return "warning";
  }

  // No schedule info at all — use simple remaining-calendar-days check
  const daysLeft = dayOfWeek === 0 ? 1 : 7 - dayOfWeek;
  if (sessionsNeeded > daysLeft) return "critical";
  return "warning";
}

/** Calculate crew pressure percentage */
export function getCrewPressure(members: MemberProgress[]): {
  pct: number;
  label: string;
  color: string;
} {
  if (members.length === 0) return { pct: 0, label: "NO DATA", color: Y2K.text2 };

  const onTrack = members.filter((m) => {
    const s = getPlayerStatus(m);
    return s === "active" || s === "clutch";
  }).length;

  const pct = Math.round((onTrack / members.length) * 100);

  if (pct >= 85) return { pct, label: Y2K.pressure.inSync.label, color: Y2K.pressure.inSync.fg };
  if (pct >= 60) return { pct, label: Y2K.pressure.cruising.label, color: Y2K.pressure.cruising.fg };
  if (pct >= 40) return { pct, label: Y2K.pressure.drifting.label, color: Y2K.pressure.drifting.fg };
  return { pct, label: Y2K.pressure.offline.label, color: Y2K.pressure.offline.fg };
}

/** Get initials from display name or username */
export function getInitials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Format volume in tonnes */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}T`;
  return `${Math.round(kg)}kg`;
}

/** Get status color for crew bar segment */
export function getStatusColor(status: PlayerStatus): string {
  return Y2K.status[status].fg;
}

// ── Backward compatibility aliases ──────────────────────────────────────────
// These allow gradual migration — components can import either name

export const TACX = Y2K;
export type OperatorStatus = PlayerStatus;
export type DivisionConfig = TierConfig;
export const divCfg = tierCfg;
export const getOperatorStatus = getPlayerStatus;
export const getFireteamPressure = getCrewPressure;
