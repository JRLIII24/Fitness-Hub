# Smart Workout Launcher - Setup & Testing Guide

## Overview

The Smart Workout Launcher is a Phase 1 adaptive intelligence feature that predicts which workout a user is most likely to want to do today based on their workout patterns.

## What's Been Built (Week 1 Complete)

✅ **Backend Foundation**:
- Migration 022 with `workout_events` table and launcher metadata
- Feature flags infrastructure (`profiles.feature_flags` JSONB column)
- Launcher prediction algorithm with 3-tier strategy
- API endpoint at `GET /api/workout/launcher`
- Event logging for analytics

✅ **Frontend**:
- Smart Launcher widget on Dashboard
- Alternative template picker (bottom sheet)
- Confidence indicators (high/medium/low)
- One-tap workout start
- Acceptance/rejection tracking

## How the Launcher Works

### Prediction Strategy (3 Tiers)

1. **High Confidence**: Day-of-week pattern detected
   - Requires 2+ workouts on the same day of week in the last 30 days
   - Returns most common template for that day
   - Example: "You usually do Push Day on Mondays"

2. **Medium Confidence**: Recent template fallback
   - No day pattern, but user has workout history
   - Returns most recent template
   - Example: "Your most recent workout"

3. **Low Confidence**: Preset workout
   - No workout history at all
   - Returns a sensible full-body compound preset
   - Example: "Recommended starter workout"

### What It Displays

- **Template name** (e.g., "Push Day A")
- **Reason** (e.g., "You usually do this on Mondays")
- **Exercise count** (e.g., "6 exercises")
- **Estimated duration** (e.g., "~45 min")
- **Confidence badge** (High Match / Good Match / Suggested)
- **Alternative templates** (2-3 quick swap options)

## Enabling the Feature

### Step 1: Run Migration 022

If not already done, run the migration in Supabase Dashboard (SQL Editor):

```bash
# Migration file location
supabase/migrations/022_workout_events_foundation.sql
```

### Step 2: Enable Feature Flag for Your User

Run this SQL in Supabase Dashboard (replace `YOUR_USER_ID`):

```sql
-- Enable launcher for a specific user
UPDATE profiles
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{launcher_enabled}',
  'true'
)
WHERE id = 'YOUR_USER_ID';
```

To find your user ID:

```sql
-- Get your user ID from email
SELECT id FROM auth.users WHERE email = 'your-email@example.com';
```

### Step 3: Verify It Works

1. **Log out and log back in** (or refresh)
2. Navigate to Dashboard (`/dashboard`)
3. You should see the Smart Launcher widget between stats and quick actions
4. If you have workout history, it will predict based on patterns
5. Click "Start Workout" to test acceptance tracking
6. Click "Swap" to see alternative templates

## Testing Different Scenarios

### Scenario 1: New User (No History)
- **Expected**: Low confidence, preset workout
- **Setup**: Create a fresh account or clear workout history

### Scenario 2: User with Day Pattern
- **Expected**: High confidence, day-specific template
- **Setup**:
  1. Create a template (e.g., "Monday Push")
  2. Complete 2+ workouts with that template on Mondays
  3. Check launcher on a Monday

### Scenario 3: Recent Workout Only
- **Expected**: Medium confidence, most recent template
- **Setup**:
  1. Complete 1 workout with a template
  2. Check launcher on a different day than you worked out

## Event Tracking

The launcher logs these events to `workout_events`:

- `launcher_shown`: When widget is displayed
- `launcher_accepted`: User clicks "Start Workout"
- `launcher_rejected`: User picks alternative or skips

Event data includes:
- `confidence` level
- `template_id` suggested
- `day_of_week` and `time_of_day`
- `time_to_decision_ms` (how long user took to decide)

## API Endpoints

### GET /api/workout/launcher

**Returns**:
```json
{
  "suggested_workout": {
    "template_id": "uuid",
    "template_name": "Push Day A",
    "exercises": [...],
    "estimated_duration_mins": 45,
    "confidence": "high",
    "reason": "You usually do this on Mondays"
  },
  "alternative_templates": [
    {
      "id": "uuid",
      "name": "Pull Day A",
      "exercise_count": 5,
      "last_used_at": "2025-02-10T14:30:00Z"
    }
  ]
}
```

### POST /api/workout/launcher

**Accepts**:
```json
{
  "template_id": "uuid",
  "accepted": true,
  "time_to_decision_ms": 2340
}
```

## Troubleshooting

### Widget Not Showing

1. **Check feature flag**: Verify `launcher_enabled: true` in your profile
2. **Check console**: Look for 403 errors (feature disabled)
3. **Reload page**: Feature flag is checked on mount

### Prediction Seems Wrong

1. **Check workout history**: Only completed workouts count
2. **Check date range**: Launcher looks at last 30 days only
3. **Check day matching**: Day-of-week uses 0-6 (Sunday = 0)

### Build Errors

- Ensure migration 022 is run first (types depend on it)
- Clear `.next` cache: `rm -rf .next && pnpm build`
- Check TypeScript errors: `pnpm tsc --noEmit`

## Next Steps (Week 2)

- [ ] Add offline cache (IndexedDB) for launcher predictions
- [ ] Add analytics instrumentation (event dashboard)
- [ ] Internal dogfooding with team
- [ ] Collect feedback on prediction accuracy

## Architecture Notes

- **Server-side prediction**: Algorithm runs on server for security
- **Client-side rendering**: Widget is a Client Component for interactivity
- **Feature flag gating**: Can disable/enable per user or globally
- **Event-driven**: All actions logged for future ML training
