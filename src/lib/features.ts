/**
 * Pod Challenges & Live Leaderboards
 * Set NEXT_PUBLIC_ENABLE_POD_CHALLENGES=true to enable challenge creation,
 * leaderboard views, and the aggregation RPC.
 */
export const POD_CHALLENGES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_POD_CHALLENGES === "true";

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

export const MOMENTUM_PROTECTION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MOMENTUM_PROTECTION === "true";

export const PUSH_NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

export const GLASS_UI_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GLASS_UI !== "false";

export const MENU_SCANNER_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MENU_SCANNER === "true";

export const FOOD_SCANNER_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_FOOD_SCANNER === "true";

export const GROCERY_GENERATOR_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GROCERY_GENERATOR === "true";

export const AI_COACH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AI_COACH === "true";

export const FORM_ANALYSIS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_FORM_ANALYSIS === "true";

export const AI_ONBOARDING_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AI_ONBOARDING === "true";

export const WORKOUT_RECAP_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WORKOUT_RECAP === "true";

export const WEEKLY_REPORT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WEEKLY_REPORT === "true";

export const PROGRAM_BUILDER_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PROGRAM_BUILDER === "true";

export const SOCIAL_FEED_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SOCIAL_FEED === "true";

export const MEAL_PLANNING_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MEAL_PLANNING === "true";

export const WEARABLE_INTEGRATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WEARABLE_INTEGRATIONS === "true";

export const EXPENDITURE_SYNC_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_EXPENDITURE_SYNC === "true";

export const POD_ARENA_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_POD_ARENA === "true";
