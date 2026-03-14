/**
 * Server-only feature flags
 *
 * This module holds feature flags whose env vars do NOT carry the NEXT_PUBLIC_
 * prefix. They are therefore NOT bundled into the client-side JavaScript
 * bundle, keeping internal operational state hidden from browser clients.
 *
 * The `import "server-only"` line below causes a hard build error if this
 * module is ever accidentally imported by a Client Component or a file that
 * the client bundle can reach. This is the canonical Next.js pattern for
 * enforcing server-only module boundaries.
 *
 * HOW TO USE:
 *   Import from this file only in:
 *     - API route handlers  (src/app/api/.../route.ts)
 *     - Server Components   (files WITHOUT "use client" directive)
 *     - Cron endpoints      (src/app/api/cron/.../route.ts)
 *     - Server Actions      (files with "use server" directive)
 *
 *   For flags needed by Client Components, keep them in features.ts with the
 *   NEXT_PUBLIC_ prefix.
 *
 * ENV VAR MIGRATION STEPS:
 *   1. Add the new server-only env var (e.g. ENABLE_MOMENTUM_PROTECTION=true)
 *      to Vercel dashboard → Settings → Environment Variables.
 *   2. Keep the old NEXT_PUBLIC_ var in place during the rollout window so
 *      existing callers don't break before you migrate them.
 *   3. Update all import sites (see "consuming files" comments below).
 *   4. Remove the old NEXT_PUBLIC_ var from Vercel and .env.local.
 */

// This import causes a build-time error if this file is imported from a
// Client Component or any module that gets bundled for the browser.
import "server-only";

// ---------------------------------------------------------------------------
// Momentum Protection (streak risk alerts + push notification cron)
//
// Consuming files:
//   src/app/api/cron/streak-check/route.ts
//
// Migration: change `MOMENTUM_PROTECTION_ENABLED` import to
//   `MOMENTUM_PROTECTION_ENABLED_SERVER` from this file.
//   Old env var: NEXT_PUBLIC_ENABLE_MOMENTUM_PROTECTION
//   New env var: ENABLE_MOMENTUM_PROTECTION
// ---------------------------------------------------------------------------
export const MOMENTUM_PROTECTION_ENABLED_SERVER =
  process.env.ENABLE_MOMENTUM_PROTECTION === "true";

// ---------------------------------------------------------------------------
// Push Notifications (Capacitor FCM device token registration)
//
// Consuming files:
//   src/app/api/notifications/register/route.ts
//
// Migration: import PUSH_NOTIFICATIONS_ENABLED_SERVER from this file.
//   Old env var: NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS
//   New env var: ENABLE_PUSH_NOTIFICATIONS
// ---------------------------------------------------------------------------
export const PUSH_NOTIFICATIONS_ENABLED_SERVER =
  process.env.ENABLE_PUSH_NOTIFICATIONS === "true";

// ---------------------------------------------------------------------------
// Weekly Report (cron-generated PDF/email digest)
//
// Consuming files:
//   src/app/api/cron/weekly-report/route.ts  (if it checks the flag)
//
// Migration: import WEEKLY_REPORT_ENABLED_SERVER from this file.
//   Old env var: NEXT_PUBLIC_ENABLE_WEEKLY_REPORT
//   New env var: ENABLE_WEEKLY_REPORT
// ---------------------------------------------------------------------------
export const WEEKLY_REPORT_ENABLED_SERVER =
  process.env.ENABLE_WEEKLY_REPORT === "true";

// ---------------------------------------------------------------------------
// Expenditure Sync (smart-surplus cron adjusting nutrition goals)
//
// Consuming files:
//   src/app/api/cron/expenditure-sync/route.ts
//
// Migration: import EXPENDITURE_SYNC_ENABLED_SERVER from this file.
//   Old env var: NEXT_PUBLIC_ENABLE_EXPENDITURE_SYNC
//   New env var: ENABLE_EXPENDITURE_SYNC
// ---------------------------------------------------------------------------
export const EXPENDITURE_SYNC_ENABLED_SERVER =
  process.env.ENABLE_EXPENDITURE_SYNC === "true";
