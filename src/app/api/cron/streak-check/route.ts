import { NextResponse } from 'next/server';
import { detectAndAlertStreakRisks } from '@/lib/momentum/streak-detector';
// Use the server-only import so this flag is NOT bundled into client JS.
// The ENABLE_MOMENTUM_PROTECTION env var (no NEXT_PUBLIC_ prefix) must be set
// in Vercel → Settings → Environment Variables for this to be enabled.
import { MOMENTUM_PROTECTION_ENABLED_SERVER as MOMENTUM_PROTECTION_ENABLED } from '@/lib/features.server';
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!MOMENTUM_PROTECTION_ENABLED) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  }

  try {
    const result = await detectAndAlertStreakRisks();
    return NextResponse.json(result);
  } catch (err) {
    logger.error('Streak check cron error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
