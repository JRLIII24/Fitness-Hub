/**
 * AI Weekly Report — Haiku prompt
 *
 * Generates a structured weekly training report with insights,
 * volume analysis, and actionable recommendations.
 */

export const WEEKLY_REPORT_SYSTEM_PROMPT = `You are a strength coach writing a weekly training report for an athlete.

Given the week's training data (sessions, volume, muscle groups, PRs) and comparison to the previous week, produce a structured report.

Rules:
- Be data-driven and specific. Reference actual numbers (volume, session count, PR weights).
- overview: 2-3 sentences summarizing the week. Compare to previous week when data is available.
- highlights: 2-4 short achievement strings (PRs, volume milestones, consistency wins).
- volume_analysis: 1-2 sentences on volume trend vs last week. Include percentage change if both weeks have data.
- muscle_balance: 1-2 sentences on which muscle groups were trained and any imbalances (e.g., push/pull ratio, upper/lower split).
- recovery_notes: 1 sentence on training frequency and rest patterns.
- action_items: 2-3 specific, actionable recommendations for next week.
- weekly_grade: A (exceptional, volume up + PRs), B (solid, consistent training), C (adequate but room for improvement), D (below par, missed sessions or low volume).
- Keep the total report under 300 words.
- No filler. No emoji. Be direct and constructive.`;

export const WEEKLY_REPORT_TOOL_NAME = "weekly_report";

export const WEEKLY_REPORT_TOOL_DESCRIPTION =
  "Generate a structured weekly training report with analysis and recommendations.";

export const WEEKLY_REPORT_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    overview: {
      type: "string",
      description: "2-3 sentence summary of the training week.",
      maxLength: 500,
    },
    highlights: {
      type: "array",
      items: { type: "string", maxLength: 100 },
      minItems: 1,
      maxItems: 4,
      description: "Short achievement strings for the week.",
    },
    volume_analysis: {
      type: "string",
      description: "Volume trend analysis vs previous week.",
      maxLength: 300,
    },
    muscle_balance: {
      type: "string",
      description: "Assessment of muscle group distribution.",
      maxLength: 300,
    },
    recovery_notes: {
      type: "string",
      description: "Training frequency and recovery assessment.",
      maxLength: 200,
    },
    action_items: {
      type: "array",
      items: { type: "string", maxLength: 150 },
      minItems: 1,
      maxItems: 3,
      description: "Specific, actionable recommendations for next week.",
    },
    weekly_grade: {
      type: "string",
      enum: ["A", "B", "C", "D"],
      description: "Overall grade for the training week.",
    },
  },
  required: [
    "overview",
    "highlights",
    "volume_analysis",
    "muscle_balance",
    "recovery_notes",
    "action_items",
    "weekly_grade",
  ],
};
