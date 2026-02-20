# 🏋️ Fit-Hub - Getting Started Guide

A comprehensive fitness tracking platform with social features, ghost workouts, and AI-powered workout planning.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **pnpm** (recommended) or npm ([Install pnpm](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/downloads))
- **Supabase Account** (free tier works!) ([Sign up](https://supabase.com))

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/JRLIII24/Fitness-Hub.git
cd Fitness-Hub
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Add your Supabase credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🗄️ Database Setup

### Step 1: Run Migrations

You need to run all database migrations in **Supabase Dashboard → SQL Editor**.

**Run these migrations in order** (copy/paste contents of each file):

```bash
# Core Tables (Required)
001_create_profiles.sql
002_create_exercises.sql
003_create_templates.sql
004_create_workout_sessions.sql
005_create_nutrition.sql
006_fix_profile_rls.sql

# Features
008_add_fiber_goal.sql
009_add_unit_preference.sql
010_social_features.sql
011_shared_items.sql
012_theme_preference.sql
013_inbox_clear_actions.sql
014_preserve_workout_history_on_template_delete.sql

# Sets (Video Clips)
015_sets_feature.sql
016_clip_category.sql
017_clip_count_triggers.sql

# Templates & Security
018_template_exercise_sets.sql
019_security_fixes.sql
020_favorited_templates_readable.sql
021_active_workout_tracking.sql

# Retention & Gamification
022_streak_system_enhancements.sql
022_workout_events_foundation.sql
023_enable_launcher_globally.sql

# Accountability Pods
024_accountability_pods.sql
025_pod_invitations.sql
026_pod_invitee_access.sql

# UI & Performance
027_add_profile_accent_color.sql
028_exercise_api_integration.sql
029_user_exercise_last_performance.sql
030_last_performance_trigger.sql
031_backfill_last_performance.sql
032_fix_last_performance_trigger_reliability.sql
033_reconcile_last_performance_index.sql

# Analytics
034_retention_events_logger.sql
035_growth_intents_and_conversion.sql
```

**Pro Tip:** You can also run `supabase/all_migrations.sql` if it exists (single file with all migrations).

### Step 2: Set Up Storage Buckets

In **Supabase Dashboard → Storage**, create these buckets:

1. **workout-clips** (for Sets video uploads)
   - Public: No
   - File size limit: 50MB
   - Allowed MIME types: `video/mp4`, `video/quicktime`, `video/webm`

### Step 3: Configure Storage Policies

For the `workout-clips` bucket, add these policies:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own clips"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'workout-clips' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read clips from followers or public profiles
CREATE POLICY "Users can view clips"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'workout-clips');

-- Allow users to delete their own clips
CREATE POLICY "Users can delete own clips"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'workout-clips' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🏃 Running the Project

### Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 🎨 Key Features

### ✅ Core Features
- **Workout Tracking** - Log exercises, sets, reps, weight with rest timer
- **Ghost Workouts** - Train against your past self (beat previous performance)
- **Nutrition Tracking** - Macro tracking, barcode scanning, meal logging
- **Smart Launcher** - AI predicts next workout based on your history
- **Adaptive Workouts** - Dynamic volume/intensity based on fatigue detection

### 🎮 Retention Mechanics
- **Streak System** - Daily workout streaks with freeze mechanic
- **XP & Leveling** - Earn XP, level up with celebrations
- **Milestone Badges** - Unlock badges at 7, 30, 100, 365 days
- **Confetti Celebrations** - Multi-stage animations on workout completion

### 👥 Social Features
- **Follow/Unfollow** - Build your fitness network
- **Pings** - Send encouragement messages
- **Sets** - Share workout video clips (TikTok-style feed)
- **Template Sharing** - Share and save workout routines
- **Public Profiles** - Showcase your streak, templates, and activity calendar

### 🤝 Accountability Pods
- **Group Challenges** - Create pods with commitments
- **Leaderboards** - Compete with pod members
- **Progress Tracking** - Weekly check-ins and stats

---

## 📁 Project Structure

```
Fit-Hub/
├── src/
│   ├── app/
│   │   ├── (app)/           # Main app routes
│   │   │   ├── dashboard/
│   │   │   ├── workout/
│   │   │   ├── nutrition/
│   │   │   ├── history/
│   │   │   ├── social/
│   │   │   ├── sets/        # Video clips
│   │   │   ├── pods/        # Accountability groups
│   │   │   └── templates/
│   │   ├── (auth)/          # Login/signup
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── workout/
│   │   ├── nutrition/
│   │   ├── social/
│   │   └── pods/
│   ├── lib/
│   │   ├── supabase/        # Supabase client
│   │   ├── adaptive/        # ML workout prediction
│   │   ├── design-tokens.css # OKLCH color system
│   │   └── utils.ts
│   ├── stores/              # Zustand state management
│   └── types/               # TypeScript types
├── supabase/
│   └── migrations/          # Database migrations
└── public/
```

---

## 🔧 Common Issues & Solutions

### Issue: "Failed to fetch" errors on dashboard

**Solution:** Run all database migrations. Tables are missing.

```bash
# Check which tables exist in Supabase Dashboard → Table Editor
# Should see: profiles, exercises, workout_sessions, nutrition_goals, etc.
```

### Issue: Build fails with TypeScript errors

**Solution:**
```bash
rm -rf .next node_modules
pnpm install
pnpm build
```

### Issue: Supabase connection fails

**Solution:** Check `.env.local` has correct credentials:
```bash
# Test connection
pnpm dev
# Navigate to http://localhost:3000/login
# Try signing up - if successful, connection works
```

### Issue: Videos won't upload (Sets feature)

**Solution:** Create `workout-clips` storage bucket and add RLS policies (see Database Setup Step 2 & 3).

---

## 🎨 Customization

### Accent Colors

Users can customize accent colors in **Settings → Appearance**. Available presets:
- Electric Blue (default)
- Sunset Orange
- Neon Pink
- Lime Green
- Purple Haze
- Gold
- Cyan
- Magenta

### Design Tokens

All colors, spacing, and motion are defined in `src/lib/design-tokens.css` using OKLCH for perceptually uniform colors.

---

## 📖 Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript compiler check
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🆘 Need Help?

- **Issues:** [GitHub Issues](https://github.com/JRLIII24/Fitness-Hub/issues)
- **Documentation:** Check the `/docs` folder (coming soon)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs:** [nextjs.org/docs](https://nextjs.org/docs)

---

## 🌟 What Makes This App Special?

### 👻 Ghost Workouts
Train against your past self! See your previous performance overlay during workouts and get real-time feedback when you beat it.

### 🎯 Smart Launcher
ML-powered predictions for your next workout based on:
- Day of week patterns
- Rest day cycles
- Exercise rotation history
- Recovery time

### 📊 Adaptive System
Dynamically adjusts workout volume based on:
- Recent workout frequency
- Total weekly volume
- Rest day gaps
- Fatigue detection

### 🎮 Gamification Done Right
- Loss aversion mechanics (streak freeze)
- Variable rewards (random PR confetti)
- Social proof (public activity calendars)
- Progress visualization (XP/leveling)

---

**Built with ❤️ using Next.js 16, Supabase, TypeScript, and Tailwind CSS**
