# Fit-Hub Features Documentation

> **Last Updated:** February 2026
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Workout Tracking](#workout-tracking)
4. [Nutrition Tracking](#nutrition-tracking)
5. [Social Features](#social-features)
6. [Analytics & Progress](#analytics--progress)
7. [User Settings & Privacy](#user-settings--privacy)
8. [Technical Features](#technical-features)

---

## Overview

**Fit-Hub** is a comprehensive fitness and health tracking application built with Next.js 16 and Supabase. It combines workout logging, nutrition tracking, and social fitness features into a unified platform that helps users achieve their fitness goals while staying connected with a community.

### Key Highlights
- 🏋️ **Workout Logging** - Track sets, reps, weight, and rest times
- 🍎 **Nutrition Tracking** - Log meals with macro tracking and barcode scanning
- 👥 **Social Fitness** - Follow friends, share workouts, post video clips
- 📊 **Analytics** - Strength trends, volume tracking, and personal records
- 🎨 **Customizable** - Custom exercises, templates, themes, and units
- 🔒 **Privacy Controls** - Public/private profiles with granular sharing

---

## Core Features

### 📱 App Navigation

**Main Pages:**
- **Dashboard** (`/`) - Your fitness hub with daily summary, quick actions, and recent activity
- **Workout** (`/workout`) - Active workout logging interface
- **History** (`/history`) - Calendar view of all past workouts
- **Templates** (`/templates`) - Manage and organize workout templates
- **Nutrition** (`/nutrition`) - Daily food log with meal tracking
- **Social** (`/social`) - Community hub for following, sharing, and discovering
- **Sets** (`/sets`) - TikTok-style workout video feed
- **Settings** (`/settings`) - Profile, preferences, and account management

### 🔐 Authentication

- **Secure Login/Signup** - Email and password authentication via Supabase Auth
- **Auto-Profile Creation** - Profiles created automatically on first login
- **Session Management** - Persistent login with secure tokens
- **Protected Routes** - All app pages require authentication

---

## Workout Tracking

### 💪 Workout Logging

**Starting Workouts:**
- Start from scratch with empty session
- Load from saved templates
- Use preset templates (6 popular workouts included)
- Edit and modify during active session

**During Workout:**
- Add exercises from 100+ exercise library
- Create custom exercises on-the-fly (NEW!)
- Track per-set details:
  - Weight (kg or lbs)
  - Reps (repetitions)
  - Duration (seconds, for time-based exercises)
  - Set type (warmup, working, dropset, failure)
  - RPE (Rate of Perceived Exertion, 1-10 scale)
  - Rest time between sets
  - Notes per set
- Built-in rest timer with audio notifications
- Collapse/expand exercises for cleaner view
- Reorder exercises via drag-and-drop
- Remove exercises or individual sets
- Add workout-level notes

**Exercise Library:**
- 100+ built-in exercises
- Custom exercise creation with:
  - Exercise name
  - Muscle group (chest, back, legs, shoulders, arms, core, full body)
  - Equipment (barbell, dumbbell, cable, machine, bodyweight, band)
  - Category (compound, isolation, cardio, stretch)
- Search by exercise name
- Filter by muscle group or equipment
- View form tips during workouts

**Previous Performance:**
- When using templates, see your last performance
- Shows up to 4 previous sets with format: `weight × reps`
- Helps track progressive overload

### 📋 Workout Templates

**Template Management:**
- Create templates from current workout
- Save frequently used workout routines
- Edit templates anytime:
  - Add/remove exercises
  - Reorder exercises
  - Set target reps, sets, and weight
  - Add exercise notes
  - Set estimated duration
  - Add template description
- Share templates publicly (optional)
- Delete templates (preserves workout history)

**Preset Templates Included:**
1. **Upper Body Strength** - Comprehensive upper body workout
2. **Push Day** - Chest, shoulders, triceps
3. **Pull Day** - Back and biceps
4. **Leg Day** - Quads, glutes, hamstrings
5. **Full Body Compound** - Major compound lifts
6. **Arms & Delts** - Arm and shoulder focus

**Template Sharing:**
- Mark templates as public/private
- Public templates visible on your profile
- Track how many users saved your template ("save count")
- Send templates directly to specific users
- Receive templates from others in your inbox

### 📅 Workout History

**View Past Workouts:**
- Calendar view showing all workout days
- Click any date to see session details
- View all exercises, sets, and performance
- Edit past workouts (fix mistakes)
- Delete individual sessions
- Session metadata:
  - Date and time
  - Duration
  - Template used (if any)
  - Total volume
  - Notes

**Active Workout Tracking:**
- Real-time "currently working out" indicator (NEW!)
- Visible on public profiles
- Syncs across devices
- Auto-cleanup after 4 hours (prevents stuck states)

---

## Nutrition Tracking

### 🍽️ Food Logging

**Daily Food Log:**
- Log meals by type:
  - Breakfast
  - Lunch
  - Dinner
  - Snack
- View by specific date (navigate prev/next days)
- Search food database
- Scan barcodes for instant lookup
- Create custom food items
- Adjust serving sizes (supports decimals)
- Add notes to entries
- Delete entries
- Edit meal type or servings

**Food Database:**
- Integrated with:
  - OpenFoodFacts (international database)
  - USDA (U.S. government database)
  - User-created custom foods
- Search by name
- Barcode scanning with camera
- Automatic nutrition calculation per serving

**Nutrition Data Tracked:**
- **Macronutrients:**
  - Calories (kcal)
  - Protein (g)
  - Carbs (g)
  - Fat (g)
- **Micronutrients:**
  - Fiber (g)
  - Sugar (g)
  - Sodium (mg)

### 🎯 Nutrition Goals

**Set Daily Targets:**
- Calories goal
- Protein target (g)
- Carbs target (g)
- Fat target (g)
- Fiber target (g)
- Goals versioned by date (change goals over time)

**Progress Tracking:**
- Visual progress bars for each macro
- Color-coded indicators:
  - Green: on track
  - Yellow: approaching limit
  - Red: over goal
- Calories remaining calculation
- Percentage of goal achieved

### 📊 Nutrition Dashboard

**Today's Summary:**
- Total calories consumed
- Macro breakdown (protein, carbs, fat)
- Fiber, sugar, sodium totals
- Total servings logged
- Quick-add recent foods

**Meal Sections:**
- Organized by meal type
- Calorie totals per meal
- Individual food items with details
- Delete/edit functionality per entry

---

## Social Features

### 👥 Following & Discovery

**User Discovery:**
- Search public profiles by username or display name
- View user cards showing:
  - Display name and username
  - Bio
  - Fitness goal badge
  - Current streak
  - "Working out now" live indicator
- Follow/unfollow users
- View following list
- Cannot follow yourself

**Public Profiles:**
- Opt-in public visibility (privacy control)
- Profile shows:
  - Bio and personal info
  - Fitness goal
  - Current workout streak (🔥)
  - Active workout status (💪)
  - Workout calendar (90-day history) (NEW!)
  - Shared workout templates
  - Favorited templates (NEW!)
  - Posted Sets (workout clips)
- Follow/unfollow buttons
- Send ping (encouragement message)

### 💬 Pings (Encouragement Messages)

**Send Pings:**
- Quick motivation messages to any user
- Default message: "💪 Keep it up!"
- Custom message support (up to 100 chars)
- One-tap send

**Ping Inbox:**
- View all received pings
- Unread count badge
- Mark as read
- Sender name and timestamp
- Reply via sending a ping back

### 📤 Sharing System

**Share Workout Templates:**
- Send templates to specific users
- Include custom message
- Full template snapshot preserved (JSONB)
- Recipient can save to their library
- Save count increments when template is saved

**Share Meal Days:**
- Send entire day's nutrition log
- Includes all meals with macro breakdown
- Full calorie and macro totals
- Optional custom message
- Informational only (recipient can't edit)

**Shared Items Inbox:**
- View all shared templates and meals
- Unread count badge
- Mark as read
- Save templates to your library
- View meal breakdowns

### 🎥 Workout Clips ("Sets")

**Upload Clips:**
- Record or upload video (5-20 seconds)
- Add caption (max 120 chars)
- Tag exercise (optional)
- Categorize clip:
  - Upper Body
  - Lower Body
  - Full Body
  - Physique
  - Posing
  - Cardio
  - Mobility
  - Other
- Auto-generated or custom thumbnail

**Sets Feed:**
- TikTok-style vertical video feed
- Full-screen playback
- Muted autoplay (tap to unmute)
- Shows clips from:
  - Users you follow
  - Public profiles
  - Your own clips
- Infinite scroll pagination

**Social Interactions:**
- **Like clips** - Double-tap or heart button
- **Comment** - Mutual followers only (prevents spam)
- **View stats** - Like count, comment count
- **Delete own clips** - Remove content you posted

**Clip Visibility:**
- Follows RLS policies
- Visible to:
  - Yourself
  - Your followers
  - Users with public profiles
- Comments require mutual follow relationship

### ⭐ Template Favorites

**Favorite Templates:**
- Heart icon on any template
- Save others' public templates as favorites
- View on your profile (NEW!)
- Favorites appear in "Favorited Templates" section
- Visible when others view your public profile (NEW!)
- Copy favorited templates to your library

---

## Analytics & Progress

### 📈 Strength Analytics

**Strength Trends:**
- Per-exercise strength tracking
- Charts showing:
  - Top set score over time (weight × reps)
  - Top weight per session
  - Volume per session
  - Personal records (PR) with dates
- Filter by exercise
- Date range selection
- Unit conversion support (kg ↔ lbs)

**Volume Tracking:**
- Total volume per session (all sets combined)
- Bar chart visualization
- Compare sessions over time

**Personal Records:**
- Automatic PR detection
- Best weight lifted per exercise
- Best reps at given weight
- PR dates displayed
- Historical PR tracking

### 🔥 Streak System

**Workout Streaks:**
- Consecutive workout days counter
- Real-time calculation on workout completion
- Database trigger updates (automatic)
- Displayed on:
  - Dashboard
  - Profile cards
  - Social profiles
- Motivational metric for consistency

### 📊 Workout Calendar

**Visual Consistency Tracker:**
- 90-day workout history calendar (NEW!)
- GitHub-style contribution calendar
- Highlighted workout days
- Shows on public profiles
- Workout count summary
- Navigate by month

---

## User Settings & Privacy

### 👤 Profile Management

**Personal Information:**
- Display name (shown to others)
- Username (unique identifier, @username)
- Bio (up to 160 characters)
- Email (view-only, set during signup)
- Height (cm or inches based on unit preference)
- Weight (kg or lbs)
- Date of birth
- Gender (male, female, other, prefer not to say)

**Fitness Goals:**
- Lose weight
- Build muscle
- Maintain weight
- Improve endurance
- Stay active
- Sport performance

### 🔒 Privacy Controls

**Profile Visibility:**
- **Public Profile Toggle:**
  - ON: Discoverable in search, visible to all
  - OFF: Private, not searchable
- Public profiles show:
  - Bio, stats, fitness goal
  - Workout clips
  - Shared templates
  - Workout calendar
  - Active workout status
  - Favorited templates

**Data Privacy:**
- Row Level Security (RLS) enforced at database level
- Users can only access their own data
- Shared templates use snapshots (preserve data)
- Soft deletion for templates (preserves workout history)

### 🎨 Customization

**Theme Settings:**
- **Mode:**
  - Light mode
  - Dark mode
  - System preference (auto)
- **Accent Color:**
  - Default (gray)
  - Pink
  - Blue
  - Custom (hex color picker)
- Themes apply across entire app

**Unit Preferences:**
- **Metric:**
  - Weight: kg
  - Height: cm
- **Imperial:**
  - Weight: lbs
  - Height: inches
- Auto-conversion in charts and displays

### 🔔 Notifications

**Unread Badges:**
- Pings unread count
- Shared items unread count
- Badge indicators on navigation tabs

---

## Technical Features

### 🗄️ Database Architecture

**Core Tables:**
- `profiles` - User information and preferences
- `exercises` - Exercise library (built-in + custom)
- `workout_templates` - User-created templates
- `template_exercises` - Exercises in templates
- `template_exercise_sets` - Target sets for template exercises
- `workout_sessions` - Completed/cancelled workouts
- `workout_sets` - Individual sets in sessions
- `food_items` - Food database
- `food_log` - Daily food entries
- `nutrition_goals` - User nutrition targets (versioned)
- `user_follows` - Follow relationships
- `pings` - Encouragement messages
- `workout_clips` - Video clips
- `clip_likes` - Like tracking
- `clip_comments` - Comments on clips
- `template_favorites` - User's favorited templates
- `shared_items` - Shared templates and meals (JSONB snapshots)
- `active_workout_sessions` - Live workout tracking (NEW!)

**Data Validation:**
- Row Level Security (RLS) on all tables
- Foreign key constraints
- Check constraints (e.g., clip duration 5-20s)
- Unique constraints (prevent duplicate follows, likes)
- Auto-timestamps (created_at, updated_at)

**Triggers:**
- Auto-update `updated_at` on changes
- Streak calculation on workout completion
- Clip count updates (likes, comments)
- Stale session cleanup (active workouts >4 hours)

### 🔄 Real-Time Features

**Active Workout Status:**
- Live tracking when user starts workout
- Syncs to database (visible across devices)
- Shows on public profiles
- 4-hour auto-cleanup prevents stuck states

**Presence Tracking:**
- `last_seen_at` timestamp
- "Currently working out" indicator
- Updates on workout start/finish

### 🌐 API Endpoints

**Authentication:**
- `POST /api/auth/ensure-profile` - Create profile after signup

**Nutrition:**
- `GET /api/nutrition/search` - Search food database
  - Query: `q` (search term), `limit` (results)
- `GET /api/nutrition/barcode/[code]` - Barcode lookup
  - Returns: Food item with full nutrition data
  - Sources: OpenFoodFacts, USDA

### 📦 State Management

**Zustand Stores:**
- `workout-store` - Active workout session state
  - Exercises, sets, notes
  - Start/finish/cancel actions
  - Async sync with database (NEW!)
- `timer-store` - Rest timer state
  - Countdown timer
  - Pause/resume/reset
  - Audio notifications

**Persistence:**
- LocalStorage backup (workout data)
- Server sync on finish
- Resume interrupted sessions

### 🎯 Performance Features

**Optimizations:**
- Server-side rendering (SSR) for initial load
- Client-side navigation (Next.js App Router)
- Memoized Supabase client instances
- Optimistic UI updates (food log, likes)
- Lazy loading for images/videos
- Pagination for large datasets

**Caching:**
- Static page generation where possible
- Browser caching for assets
- Supabase query caching

---

## Feature Roadmap

### ✅ Completed Features

- ✅ Workout logging with sets and reps
- ✅ Workout templates
- ✅ Nutrition tracking with barcode scanning
- ✅ User profiles and following system
- ✅ Workout clips (Sets)
- ✅ Template and meal sharing
- ✅ Pings (encouragement messages)
- ✅ Strength analytics and progress charts
- ✅ Custom themes and unit preferences
- ✅ Active workout status tracking (NEW!)
- ✅ Workout calendar on profiles (NEW!)
- ✅ Custom exercise creation (NEW!)
- ✅ Template favorites display (NEW!)

### 🚧 Potential Future Enhancements

- ⏳ Nutrition trend charts (7/30 day)
- ⏳ Meal planning and prep
- ⏳ Workout program builder (multi-week)
- ⏳ Exercise video library
- ⏳ Form check requests (video analysis)
- ⏳ Group challenges
- ⏳ Leaderboards
- ⏳ Integration with fitness wearables
- ⏳ Export data (CSV, PDF)
- ⏳ Advanced filtering and search

---

## User Capabilities Summary

### What Users Can Create ➕

- Workout sessions (from scratch or templates)
- Workout templates (save current workout)
- Custom exercises (muscle group, equipment, category)
- Food log entries (meals with macros)
- Nutrition goals (daily targets)
- Custom food items (with nutrition data)
- Workout clips (5-20 second videos)
- Comments on clips (mutual followers only)
- Pings (encouragement messages)

### What Users Can Edit ✏️

- Profile information (name, bio, stats, goals)
- Workout templates (exercises, sets, parameters)
- Past workout sessions (date, time, notes)
- Food log entries (meal type, servings)
- Nutrition goals (daily targets)
- Preferences (units, theme, privacy)
- Active workout (add/remove exercises, update sets)

### What Users Can Delete 🗑️

- Workout sessions (with confirmation)
- Workout templates (soft delete, preserves history)
- Food log entries
- Workout clips (own clips only)
- Comments (own comments only)
- Follow relationships (unfollow)
- Shared items from inbox

### What Users Can View 👁️

- **Own Data:**
  - Complete workout history
  - All nutrition logs
  - Strength analytics and trends
  - Personal records
  - Templates and favorites
- **Others' Data:**
  - Public profiles (if opted-in)
  - Followers' workout clips
  - Public shared templates
  - Social search results
- **Social Interactions:**
  - Pings received
  - Shared templates/meals
  - Clip comments (if mutual followers)

---

## Support & Documentation

### Getting Started
1. **Sign up** with email and password
2. **Complete profile** - Add display name, bio, fitness goal
3. **Start a workout** - Use preset template or create your own
4. **Log nutrition** - Scan barcodes or search food database
5. **Go social** - Make profile public, follow friends, post clips

### Tips for Success
- 🎯 Set realistic nutrition goals based on your fitness objective
- 📋 Create templates for your favorite workouts to save time
- 📸 Post workout clips to stay accountable and inspire others
- 💬 Use pings to encourage friends and build community
- 📊 Check progress analytics weekly to track strength gains
- 🔥 Maintain your streak for consistency motivation

### Privacy Best Practices
- Keep profile private until comfortable sharing
- Only share templates you want others to copy
- Mutual follow requirement protects clip comments
- Review shared items before saving to your library

---

**Built with:**
Next.js 16 • Supabase • TypeScript • Tailwind CSS • shadcn/ui

**Questions or feedback?**
[GitHub Issues](https://github.com/anthropics/claude-code/issues)

---

*Last updated: February 2026*
