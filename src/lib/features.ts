/**
 * Community Template Marketplace
 * Set NEXT_PUBLIC_ENABLE_MARKETPLACE=true to enable the marketplace route,
 * discovery API, and template import flow.
 */
export const MARKETPLACE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE === "true";

/**
 * Pod Challenges & Live Leaderboards
 * Set NEXT_PUBLIC_ENABLE_POD_CHALLENGES=true to enable challenge creation,
 * leaderboard views, and the aggregation RPC.
 */
export const POD_CHALLENGES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_POD_CHALLENGES === "true";

export const AI_PROGRESS_INSIGHT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AI_PROGRESS_INSIGHT === "true";

export const AI_NUTRITION_ADVISOR_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AI_NUTRITION_ADVISOR === "true";

export const AI_RECOVERY_ADVISOR_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AI_RECOVERY_ADVISOR === "true";

export const VOICE_LOGGING_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_VOICE_LOGGING === "true";

export const PLATE_CALCULATOR_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PLATE_CALCULATOR === "true";

export const NATIVE_MIN_VERSION = parseInt(
  process.env.NEXT_PUBLIC_NATIVE_MIN_VERSION ?? "1",
  10
);

export const SMART_LAUNCHER_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SMART_LAUNCHER === "true";

export const READINESS_SCORE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_READINESS_SCORE === "true";

export const HEALTHKIT_SYNC_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_HEALTHKIT_SYNC === "true";

export const FOOD_VISION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_FOOD_VISION === "true";

export const MOMENTUM_PROTECTION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MOMENTUM_PROTECTION === "true";

export const PUSH_NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

export const GLASS_UI_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GLASS_UI !== "false";
