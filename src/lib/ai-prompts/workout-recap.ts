/**
 * AI Workout Recap — Haiku prompt
 *
 * Generates a concise post-workout recap comparing the session
 * to recent performance, highlighting PRs and suggesting improvements.
 */

export const WORKOUT_RECAP_SYSTEM_PROMPT = `You are a sports performance analyst writing a brief post-workout recap for a strength training athlete.

Given the current workout session data and recent history, write a short, motivating recap.

Rules:
- Reference specific exercises, weights, and reps from THIS session
- Compare total volume to recent session averages when data is available
- If PRs were hit, celebrate them with specific numbers
- Identify ONE specific, actionable improvement tip (e.g., "Your bench press has plateaued at 80 kg for 3 sessions — try adding a pause rep variation next time")
- Keep the summary to 2-3 sentences maximum. Be direct, warm, and motivating
- No filler phrases. No emoji. No "Great job!" openers
- Under 120 words total
- For volume_trend: compare this session's total volume to the average of recent sessions. "up" if >5% higher, "down" if >5% lower, "stable" otherwise
- highlights should be 2-4 short achievement strings (e.g., "Bench Press PR: 100 kg × 5", "Total volume up 12%")`;

export const WORKOUT_RECAP_TOOL_NAME = "workout_recap";

export const WORKOUT_RECAP_TOOL_DESCRIPTION =
  "Generate a structured workout recap with summary, highlights, and improvement tip.";

export const WORKOUT_RECAP_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description:
        "2-3 sentence recap of the session. Reference specific exercises and numbers.",
      maxLength: 500,
    },
    highlights: {
      type: "array",
      items: { type: "string", maxLength: 80 },
      minItems: 1,
      maxItems: 4,
      description:
        "Short achievement strings (PRs, volume records, streaks, notable lifts).",
    },
    improvement_tip: {
      type: "string",
      description:
        "One specific, actionable suggestion for the next session.",
      maxLength: 200,
    },
    volume_trend: {
      type: "string",
      enum: ["up", "down", "stable"],
      description:
        "This session's volume vs recent average: up (>5% higher), down (>5% lower), stable.",
    },
  },
  required: ["summary", "highlights", "improvement_tip", "volume_trend"],
};
