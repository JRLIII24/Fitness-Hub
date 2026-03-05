# Fit-Hub AI Capabilities

> Last updated: March 2026
> AI Provider: Anthropic Claude (Sonnet 4.6 for reasoning, Haiku 4.5 for fast tasks)

---

## Current Capabilities

### 1. AI Coach (Agentic Workout Assistant)
**Route**: `POST /api/ai/coach`
**Model**: Claude Sonnet · **Rate limit**: 30 messages/day
**Access**: Floating action button on workout page → slide-up chat sheet

The coach can **directly mutate the active workout** — not just advise.

#### Mutation Actions (modifies workout in real-time)
| Action | Trigger Example |
|--------|----------------|
| `add_exercise` | "Add bench press", "throw in some curls" |
| `add_sets` | "I did 225 for 5", "log 100kg x 8", "3 sets of 10" |
| `swap_exercise` | "Swap squats for leg press" |
| `update_set` | "Change set 2 to 100kg", "that was RPE 9" |
| `remove_exercise` | "Remove leg extensions", "skip the curls" |
| `create_and_add_exercise` | Custom/unusual movements not in the library |
| `start_timer` | "Start 90 second rest", "2 minute break" |

#### Display Actions (shows info, no workout changes)
| Action | What it shows |
|--------|--------------|
| `show_exercise_history` | Past performance for a specific exercise |
| `show_prescription` | AI-recommended weight/reps based on readiness + history |
| `show_readiness` | Current readiness/recovery status |
| `show_recovery` | Per-muscle recovery breakdown |
| `show_substitution` | Alternative exercises for a given movement |
| `generate_workout` | Suggests a full workout plan |

#### Voice Integration
- **Mic toggle**: Tap to start → stays listening until tapped again (no auto-stop)
- **Voice Intent API** (`POST /api/ai/voice-intent`, Haiku): classifies speech into `log_set`, `start_timer`, `swap_exercise`, `ask_coach`, etc.
- Local regex fallback handles simple commands without an API call
- **Jarvis TTS**: Coach replies are spoken aloud using Web Speech API (British male "Daniel" voice, rate 0.88, pitch 0.82) — toggleable via volume icon in chat header, persisted in localStorage

#### Context the Coach Receives
- Full active workout: every exercise, every set (weight, reps, RPE, completion status)
- Readiness score (0–100) and level
- Sessions in last 7 days + current streak
- Fitness goal and experience level

---

### 2. Food Scanner (Computer Vision)
**Route**: `POST /api/nutrition/food-scan`
**Model**: Claude Sonnet (vision) · **Rate limit**: 20 scans/day
**Access**: Nutrition page → camera icon

- Analyzes a photo (or camera capture) and identifies all food items
- Estimates calories, protein, carbs, fat per item
- Returns up to 20 items with portion assumptions and confidence levels
- User reviews/edits items before confirming
- Confirmed items are logged to `food_log` via `POST /api/nutrition/food-log`

---

### 3. Menu Scanner
**Route**: `POST /api/nutrition/menu-scan`
**Model**: Claude Sonnet (vision) · **Rate limit**: 10 scans/day
**Access**: Nutrition page → menu scan

- Photos a restaurant menu and extracts all dishes
- Aware of user's remaining macro budget for the day
- Recommends dishes that best fit remaining targets
- Surfaced in a bottom-sheet with recommendation cards

---

### 4. Grocery List Generator
**Route**: `POST /api/nutrition/grocery-list`
**Model**: Claude Sonnet · **Rate limit**: 5 lists/day
**Access**: Nutrition page → grocery list

- Generates a weekly grocery list based on user's nutrition goals (calories, protein, carbs, fat)
- Categorizes by aisle: Proteins, Produce, Dairy, Grains, Other
- Upserts to `grocery_lists` table — existing list is replaced, not duplicated
- Displayed in a Kanban-style board (`grocery-list-board.tsx`)

---

### 5. AI Onboarding Coach
**Route**: `POST /api/ai/onboarding-coach`
**Model**: Claude Haiku · **Rate limit**: 50/day
**Access**: Onboarding step 9 (AI Coach step)

- Conversational goal-setting during initial app setup
- Uses Mifflin-St Jeor BMR + TDEE + rate-based calorie delta to compute nutrition targets
- Outputs structured `nutrition_goals` (calories, protein, carbs, fat) saved to the DB on completion

---

### 6. Adaptive Workout Engine (Rule-Based AI)
**Access**: Smart launcher widget on workout page

- Reads per-muscle recovery status from `get_muscle_group_recovery` RPC
- Auto-swaps exercises when a muscle group is below `AUTO_SWAP_THRESHOLD` (40% recovery)
- Only uses safe muscles (≥ `SAFE_RECOVERY_THRESHOLD` = 60%)
- Substitution map covers chest, back, shoulders, legs, arms, core, glutes
- Generated workouts include `swaps[]` array explaining any auto-substitutions
- Displayed in the smart launcher widget with recovery context

---

## Feature Flags

All AI features are gated behind environment variables:

| Flag | Feature |
|------|---------|
| `NEXT_PUBLIC_ENABLE_FOOD_VISION` | Food scanner + menu scanner |
| `NEXT_PUBLIC_ENABLE_AI_ONBOARDING` | AI onboarding coach step |
| `NEXT_PUBLIC_ENABLE_READINESS_SCORE` | Readiness score used by coach context |

The coach chat itself is always available when `ANTHROPIC_API_KEY` is set — no separate flag.

---

## What AI Cannot Do Yet (Planned)

### P0 — Core Coach Expansions

#### Start a Workout
- User asks: "Start a push day" or "Start my chest workout"
- Coach should launch the smart launcher, pick a template or generate one, and begin the session
- **Implementation**: Add `start_workout` action to coach → calls `/api/workout/launcher` internally

#### Suggest a Workout During a Session
- Mid-workout: "What should I do next?" or "I only have 20 minutes left"
- Coach suggests next exercises or adjusts remaining plan based on time/fatigue
- **Implementation**: Add `suggest_next_exercise` display action; leverage existing `generate_workout` + recovery context

#### Offer Replacement Workouts With Confirmation
- Coach proposes: "Your chest is still recovering — want me to swap this to a back day instead?"
- **User must confirm before any workout-level changes are made** (currently mutation actions execute immediately)
- **Implementation**: Add a `pending_action` state to coach messages; show a confirmation card in the chat before executing swap/replace

#### Create Custom Templates
- User says: "Save this workout as a template called 'Heavy Push A'"
- Coach creates a `workout_template` + `template_exercises` from the current session
- **Implementation**: Add `create_template` mutation action → calls template creation API

---

### P1 — Expand AI Across All App Sections

| Section | Planned AI Feature |
|---------|------------------|
| **Dashboard** | Daily readiness summary spoken by Jarvis on open; "What should I train today?" quick-action |
| **History / Progress** | "Explain my progress" — coach narrates trend data from the charts |
| **Body Metrics** | Weight trend analysis: "You're on track for your goal — here's why" |
| **Nutrition** | Meal planning: "Plan my meals for the week given my macros" |
| **Marketplace** | Template recommendations: "Find me a 4-day hypertrophy program" |
| **Pods** | Challenge suggestions: "Create a volume challenge for this week" |
| **Settings / Onboarding** | Re-run AI goal-setting: "I want to change my goals" |

---

### P2 — Intelligence Improvements

- **Multi-turn confirmation flow**: Coach should ask clarifying questions before executing ambiguous mutations (e.g., "Did you mean the barbell bench or dumbbell bench?")
- **Progressive overload tracking**: Coach proactively notices when user has stalled and suggests a micro-cycle
- **Workout summary on finish**: After ending a session, coach auto-generates a 2–3 sentence summary of what was accomplished
- **Persistent coach memory**: Coach remembers user preferences across sessions (preferred units, avoided exercises, past injuries) via a `coach_memory` table
- **Proactive nudges**: Momentum protection already detects streak risk — connect it to the coach so it can send personalized encouragement, not just push notifications

---

## Architecture Notes

### How the Coach Works (Data Flow)
```
User message
  → POST /api/ai/coach
  → callAnthropicWithTool() [25s timeout]
  → Claude Sonnet returns { reply, action, data }
  → CoachResponseSchema.parse() [Zod validation]
  → returned to client
  → action-executor.ts dispatches mutation to useWorkoutStore / useTimerStore
  → UI updates optimistically
  → coach chat appends message with actionResult
```

### Adding a New Coach Action (Checklist)
1. Add action string to `CoachAction` type in `src/lib/coach/types.ts`
2. Add to `MUTATION_ACTIONS` array if it mutates state
3. Add typed `*ActionData` interface
4. Update `TOOL_SCHEMA` enum in `src/app/api/ai/coach/route.ts`
5. Add handler in `src/lib/coach/action-executor.ts`
6. Update system prompt in `src/lib/ai-prompts/coach.ts` to describe when to use it
7. Add UI rendering in `coach-chat-sheet.tsx` if it needs a custom display card

---

## Rate Limit Summary

| Feature | Limit |
|---------|-------|
| AI Coach messages | 30 / day |
| Food Scanner | 20 / day |
| Menu Scanner | 10 / day |
| Grocery List | 5 / day |
| Onboarding Coach | 50 / day |
| Voice Intent | 100 / day |

Rate limits are enforced server-side via `rateLimit()` in `src/lib/rate-limit.ts`, keyed by `userId`.
