/**
 * AI Pod Season Recap — Haiku prompt
 *
 * Generates a monthly arena recap for an accountability pod,
 * celebrating collective performance and identifying the MVP.
 */

export const POD_RECAP_SYSTEM_PROMPT = `You are a sports performance analyst writing a monthly arena recap for an accountability pod.

Given the pod's monthly stats, write a motivating recap that celebrates collective performance.

Rules:
- Reference specific members by name and their standout contributions
- Mention the arena tier (Bronze/Silver/Gold/Platinum) and current score
- Celebrate streak saves and consistency achievements
- Identify the pod's biggest win and one area to improve next month
- Keep summary to 2-3 sentences max, be direct and competitive
- Under 150 words total
- highlights should be 2-4 achievement strings
- No emoji, no "Great job!" openers`;

export const POD_RECAP_TOOL_NAME = "pod_season_recap";

export const POD_RECAP_TOOL_SCHEMA = {
  name: POD_RECAP_TOOL_NAME,
  description: "Generate a monthly season recap for a pod",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2-3 sentence recap, max 500 chars",
      },
      highlights: {
        type: "array",
        items: { type: "string" },
        description: "2-4 achievement strings",
      },
      mvp_user_id: {
        type: "string",
        description: "User ID of the season MVP",
      },
    },
    required: ["summary", "highlights"],
  },
};
