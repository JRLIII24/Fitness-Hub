/**
 * Form Analysis zod contracts — server-side validation for API requests/responses.
 */

import { z } from "zod";

// ── Request schemas ──

export const AnalyzeRequestSchema = z.object({
  videoId: z.string().uuid(),
  selectedExercise: z.string().max(200).nullable(),
  durationSeconds: z.number().min(1).max(60),
  frames: z
    .array(
      z.object({
        timestampSeconds: z.number().min(0),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(100), // must be non-trivial
      }),
    )
    .min(1)
    .max(8),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ── AI tool output schema ──

// NOTE: No .min()/.max() — Anthropic rejects min/max/minLength/maxLength
// in structured output schemas. Constraints enforced via system prompt.
export const FormAnalysisToolSchema = z.object({
  exercise_detected: z.string().nullable(),
  exercise_confidence: z.enum(["low", "medium", "high"]),
  overall_score: z.number(),
  summary: z.string(),
  issues: z.array(
    z.object({
      body_part: z.string(),
      issue_type: z.string().optional(),
      severity: z.enum(["minor", "moderate", "major"]),
      timestamp_seconds: z.number().optional(),
      description: z.string(),
      correction: z.string(),
      cue: z.string().optional(),
      confidence: z.number().optional(),
    }),
  ),
  praise: z.array(z.string()),
  recommendations: z.array(z.string()),
  safety_notes: z.array(z.string()),
});

export type FormAnalysisToolOutput = z.infer<typeof FormAnalysisToolSchema>;

/** JSON Schema for the Anthropic tool definition */
export const FORM_ANALYSIS_TOOL_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    exercise_detected: { type: ["string", "null"] },
    exercise_confidence: { type: "string", enum: ["low", "medium", "high"] },
    overall_score: { type: "number", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          body_part: { type: "string" },
          issue_type: { type: "string" },
          severity: { type: "string", enum: ["minor", "moderate", "major"] },
          timestamp_seconds: { type: "number" },
          description: { type: "string" },
          correction: { type: "string" },
          cue: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["body_part", "severity", "description", "correction"],
      },
    },
    praise: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    safety_notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "exercise_detected",
    "exercise_confidence",
    "overall_score",
    "summary",
    "issues",
    "praise",
    "recommendations",
    "safety_notes",
  ],
};
