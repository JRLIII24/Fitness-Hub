/**
 * AI Program Builder — Sonnet prompt + Zod schemas
 *
 * Generates multi-week periodized training programs (mesocycles)
 * with progressive overload, deload weeks, and muscle balance.
 */

import { z } from "zod";

export const PROGRAM_BUILDER_SYSTEM_PROMPT = `You are an elite strength coach creating a periodized training program (mesocycle).

Given the user's goal, available days, experience level, and equipment, design a complete multi-week program.

## Periodization Principles
- Structure weeks into phases: Accumulation (higher volume) → Intensification (higher intensity) → Realization (peak/test) → Deload
- Every 3-4 weeks include a deload week: reduce volume 40-50%, maintain intensity at 60-70%
- Progressive overload: increase weight 2-5% weekly for compounds, increase reps or sets for accessories

## Exercise Selection Rules
- Use standard, well-known exercise names (e.g., "Barbell Squat", "Bench Press", "Lat Pulldown", "Romanian Deadlift")
- Ensure push/pull balance within each week
- Never train the same muscle group on consecutive days
- Include both compound and isolation movements
- For each exercise, specify muscle_group from: chest, back, legs, shoulders, arms, core

## Workout Coverage Audit
Before finalizing ANY training day, run this coverage audit and auto-fix gaps.

**Movement Pattern Requirements by Day Type:**
- Full Body days: squat, hinge, horizontal push, horizontal pull, core stability
- Upper Body days: horizontal push, horizontal pull, vertical push, vertical pull, scapular stability
- Lower Body days: squat, hinge, unilateral leg work, core stability
- Push days: horizontal push, vertical push, core stability
- Pull days: horizontal pull, vertical pull, scapular stability, core stability
- Athletic/Power days: power movement, squat or hinge, upper push, upper pull, anti-rotation or core

**Structural Balance (per day AND per week):**
- Horizontal push volume must NOT exceed horizontal pull volume
- Vertical push volume must NOT exceed vertical pull volume
- Posterior chain (hamstrings + glutes + upper back) must receive EQUAL or GREATER volume than quads

**Never-Neglect Rule:**
These muscles are commonly skipped and MUST appear somewhere in every training week:
rear delts, upper back, hamstrings, glutes, calves, core.
If any group has zero weekly volume, add an appropriate exercise to the most suitable day.

**Quality Check:**
Score each day 1–10 on movement coverage, muscle balance, and stimulus. If any day scores < 9, revise it.

## Program Structure
- Each week has a focus (e.g., "Accumulation - Volume", "Intensification - Strength", "Deload")
- Each day has a name describing the split (e.g., "Upper Strength", "Lower Hypertrophy", "Push Day")
- Each exercise includes target sets, reps (as string like "8-12" or "5"), RPE target, and rest seconds
- Compound lifts: 3-5 sets, 3-8 reps, 120-180s rest
- Accessory work: 2-4 sets, 8-15 reps, 60-90s rest
- 4-7 exercises per day

## Output Format
Return via the tool with: name, description, weeks array where each week has week_number, focus, and days array.`;

// ---------------------------------------------------------------------------
// Strict Zod schemas — single source of truth for program structure
// ---------------------------------------------------------------------------

// NOTE: Anthropic's structured output rejects minLength, maxLength, minimum,
// maximum, minItems, maxItems — so we use bare types here. Value constraints
// are enforced via the system prompt instead.

export const ProgramExerciseSchema = z.object({
  exercise_name: z.string(),
  muscle_group: z.string(),
  sets: z.number(),
  reps: z.string(), // "8-12", "5", "AMRAP"
  rpe_target: z.number().optional(),
  rest_seconds: z.number(),
});

export const ProgramDaySchema = z.object({
  day_number: z.number(),
  name: z.string(),
  exercises: z.array(ProgramExerciseSchema),
});

export const ProgramWeekSchema = z.object({
  week_number: z.number(),
  focus: z.string(),
  days: z.array(ProgramDaySchema),
});

export const ProgramSchema = z.object({
  name: z.string(),
  description: z.string(),
  weeks: z.array(ProgramWeekSchema),
});

export type Program = z.infer<typeof ProgramSchema>;
