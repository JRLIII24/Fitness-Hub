import { NextResponse } from 'next/server';
import { detectAndAlertStreakRisks } from '@/lib/momentum/streak-detector';
import { MOMENTUM_PROTECTION_ENABLED } from '@/lib/features';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!MOMENTUM_PROTECTION_ENABLED) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  }

  const result = await detectAndAlertStreakRisks();
  return NextResponse.json(result);
}
