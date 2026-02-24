export const RUN_FEATURE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_RUN_FEATURE === "true";

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
