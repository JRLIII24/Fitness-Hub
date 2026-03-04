import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from './push-sender';

interface AtRiskUser {
  user_id: string;
  display_name: string | null;
  current_streak: number;
  hours_since_last_workout: number;
  risk_level: 'warning' | 'critical';
  pod_ids: string[];
}

export async function detectAndAlertStreakRisks(): Promise<{ alerted: number; skipped: number }> {
  const supabase = await createClient();
  let alerted = 0;
  let skipped = 0;

  const { data: atRiskUsers, error } = await supabase.rpc('detect_streak_risk_users');
  if (error || !atRiskUsers || atRiskUsers.length === 0) {
    return { alerted: 0, skipped: 0 };
  }

  const today = new Date().toISOString().split('T')[0];

  for (const user of atRiskUsers as AtRiskUser[]) {
    // Dedup check
    const { data: existing } = await supabase
      .from('streak_risk_alerts')
      .select('id')
      .eq('user_id', user.user_id)
      .eq('alert_date', today)
      .eq('risk_level', user.risk_level)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Find pod members to notify
    if (user.pod_ids.length === 0) {
      skipped++;
      continue;
    }

    const { data: podMembers } = await supabase
      .from('pod_members')
      .select('user_id')
      .in('pod_id', user.pod_ids)
      .neq('user_id', user.user_id);

    if (!podMembers || podMembers.length === 0) {
      skipped++;
      continue;
    }

    const memberIds = [...new Set(podMembers.map(m => m.user_id))];

    // Filter by notification preferences + quiet hours
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, streak_alerts_enabled, quiet_hours_start, quiet_hours_end')
      .in('user_id', memberIds);

    const currentHour = new Date().getUTCHours();
    const eligibleMembers = memberIds.filter(memberId => {
      const memberPref = prefs?.find(p => p.user_id === memberId);
      if (memberPref) {
        if (!memberPref.streak_alerts_enabled) return false;
        if (memberPref.quiet_hours_start != null && memberPref.quiet_hours_end != null) {
          if (isInQuietHours(currentHour, memberPref.quiet_hours_start, memberPref.quiet_hours_end)) {
            return false;
          }
        }
      }
      return true; // default: alerts enabled if no preference record
    });

    // Send push + in-app ping
    const streakText = user.current_streak;
    const urgency = user.risk_level === 'critical' ? '\u{1F525}' : '\u26A1';
    const message = `${urgency} ${user.display_name || 'Your pod mate'} is about to lose their ${streakText}-day streak! Send them a ping!`;

    for (const memberId of eligibleMembers) {
      await sendPushToUser(memberId, {
        title: 'Streak Alert',
        body: message,
        data: { type: 'streak_alert', userId: user.user_id },
      });

      await supabase.from('pings').insert({
        sender_id: user.user_id,
        recipient_id: memberId,
        message,
      });
    }

    // Record alert
    await supabase.from('streak_risk_alerts').insert({
      user_id: user.user_id,
      alert_date: today,
      risk_level: user.risk_level,
      streak_count: user.current_streak,
      notified_pod_member_ids: eligibleMembers,
    });

    alerted++;
  }

  return { alerted, skipped };
}

function isInQuietHours(currentHour: number, start: number, end: number): boolean {
  if (start <= end) {
    return currentHour >= start && currentHour < end;
  }
  // Wraps midnight (e.g., 22-7)
  return currentHour >= start || currentHour < end;
}
