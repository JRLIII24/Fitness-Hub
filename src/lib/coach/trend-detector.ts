/**
 * Multi-session trend detection from Coach's Notes (session_summaries).
 * Runs client-side to surface patterns in CoachContext.
 */

export interface DetectedTrend {
  type:
    | "volume_increasing"
    | "volume_decreasing"
    | "pr_streak"
    | "stall"
    | "consistency_high"
    | "consistency_dropping";
  description: string;
  confidence: number; // 0-1
}

interface SessionNote {
  summary: string;
  key_observations: Record<string, unknown> | null;
  created_at: string;
}

export function detectTrends(
  sessionNotes: SessionNote[] | null | undefined,
  streak: number,
  sessionsThisWeek: number,
): DetectedTrend[] {
  const trends: DetectedTrend[] = [];
  if (!sessionNotes || sessionNotes.length < 2) return trends;

  // Volume trend from key_observations
  const volumeTrends = sessionNotes
    .map((n) => n.key_observations?.volume_trend as string | undefined)
    .filter(Boolean);

  if (volumeTrends.length >= 2) {
    const allIncreasing = volumeTrends.every((t) => t === "increasing");
    const allDecreasing = volumeTrends.every((t) => t === "decreasing");

    if (allIncreasing) {
      trends.push({
        type: "volume_increasing",
        description: `Volume has been trending up across your last ${volumeTrends.length} sessions`,
        confidence: 0.8,
      });
    } else if (allDecreasing) {
      trends.push({
        type: "volume_decreasing",
        description: `Volume has been declining over your last ${volumeTrends.length} sessions`,
        confidence: 0.8,
      });
    }
  }

  // PR streak detection
  const sessionsWithPRs = sessionNotes.filter((n) => {
    const prs = n.key_observations?.prs;
    return Array.isArray(prs) && prs.length > 0;
  });

  if (sessionsWithPRs.length >= 2) {
    trends.push({
      type: "pr_streak",
      description: `You've hit PRs in ${sessionsWithPRs.length} of your last ${sessionNotes.length} sessions`,
      confidence: 0.85,
    });
  }

  // Stall detection from summaries
  const stallKeywords = ["stall", "plateau", "stuck", "same weight", "struggling", "no progress"];
  const stallNotes = sessionNotes.filter((n) => {
    const lower = n.summary.toLowerCase();
    return stallKeywords.some((kw) => lower.includes(kw));
  });

  const stalls = sessionNotes
    .map((n) => n.key_observations?.stalls)
    .filter((s) => Array.isArray(s) && s.length > 0);

  if (stallNotes.length >= 2 || stalls.length >= 2) {
    trends.push({
      type: "stall",
      description: "Performance has plateaued across recent sessions — consider a deload or variation change",
      confidence: 0.75,
    });
  }

  // Consistency patterns
  if (streak >= 7 && sessionsThisWeek >= 4) {
    trends.push({
      type: "consistency_high",
      description: `${streak}-day streak with ${sessionsThisWeek} sessions this week — outstanding consistency`,
      confidence: 0.9,
    });
  } else if (streak <= 1 && sessionsThisWeek <= 1) {
    trends.push({
      type: "consistency_dropping",
      description: "Training frequency has dropped this week",
      confidence: 0.6,
    });
  }

  return trends;
}
