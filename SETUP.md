# Fit-Hub — Supabase Setup Guide

## 1. Prerequisites

- Node.js 18+ and pnpm installed
- A Supabase account at [supabase.com](https://supabase.com)
- Supabase CLI (`pnpm add -D supabase` — already in devDependencies)

---

## 2. Environment Variables

Your `.env.local` already has the Supabase URL and anon key filled in. You still need to add the **service role key** (used for admin operations like seeding):

1. Go to your Supabase project dashboard → **Settings → API**
2. Copy the **service_role** key (keep it secret — never expose in the browser)
3. Update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://krhpilsifxxziuatrisp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<paste service role key here>
```

---

## 3. Run Database Migrations

The 5 migration files in `supabase/migrations/` create all tables, enums, triggers, and Row Level Security policies.

### Option A — Supabase CLI (recommended for local dev)

```bash
# Link CLI to your cloud project (one-time setup)
pnpm supabase login
pnpm supabase link --project-ref krhpilsifxxziuatrisp

# Push all migrations to the cloud database
pnpm supabase db push
```

### Option B — Supabase Dashboard SQL Editor

Run each file in order directly in **SQL Editor** at [supabase.com/dashboard](https://supabase.com/dashboard):

1. `supabase/migrations/001_create_profiles.sql`
2. `supabase/migrations/002_create_exercises.sql`
3. `supabase/migrations/003_create_templates.sql`
4. `supabase/migrations/004_create_workout_sessions.sql`
5. `supabase/migrations/005_create_nutrition.sql`

---

## 4. What the Migrations Create

| Migration | Tables / Objects |
|-----------|-----------------|
| 001 | `profiles`, `gender_type` enum, `fitness_goal_type` enum, auto-create profile trigger on signup |
| 002 | `exercises` (library + custom exercises) |
| 003 | `workout_templates`, `template_exercises` |
| 004 | `workout_sessions`, `workout_sets` |
| 005 | `food_items`, `nutrition_goals`, `food_log` |

All user-owned tables have **Row Level Security** enabled — users can only read/write their own data.

---

## 5. Generate TypeScript Types (optional but recommended)

Once migrations are applied, replace the hand-written `src/types/database.ts` with auto-generated types that match supabase-js exactly:

```bash
pnpm supabase gen types typescript \
  --project-id krhpilsifxxziuatrisp \
  > src/types/database.ts
```

Then update both Supabase clients to use the typed version:

**`src/lib/supabase/client.ts`**
```ts
import type { Database } from "@/types/database";
// change: createBrowserClient<any>  →  createBrowserClient<Database>
```

**`src/lib/supabase/server.ts`**
```ts
import type { Database } from "@/types/database";
// change: createServerClient<any>  →  createServerClient<Database>
```

---

## 6. Configure Supabase Auth

In your Supabase dashboard → **Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | `http://localhost:3000` (dev) or your production URL |
| Redirect URLs | `http://localhost:3000/**` |

For email confirmations in production, set up an SMTP provider under **Authentication → Email**.

---

## 7. Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`. Create an account and your profile is auto-created by the database trigger.

---

## 8. Enabling AI Features (future)

AI features are stubbed throughout the app. To activate them:

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Implement the stub API routes in `src/app/api/ai/` using the Vercel AI SDK:
   ```bash
   pnpm add ai @ai-sdk/anthropic
   ```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `relation "profiles" does not exist` | Run migrations (step 3) |
| `invalid API key` | Check `.env.local` values match your Supabase project |
| `permission denied for table` | RLS policies require a logged-in user — sign in first |
| Font loading errors at build time | Uses local `geist` package, no network required |
| `supabase: command not found` | Run `pnpm supabase` (not global `supabase`) |
