/**
 * Weekly Report Cron
 * GET /api/cron/weekly-report
 *
 * Runs Sunday 8 PM UTC. Generates AI training summaries
 * for all users who trained this week.
 *
 * Auth: CRON_SECRET bearer token
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { WEEKLY_REPORT_SYSTEM_PROMPT } from "@/lib/ai-prompts/weekly-report";
import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
const ReportSchema = z.object({
  overview: z.string(),
  highlights: z.array(z.string()),
  volume_analysis: z.string(),
  muscle_balance: z.string(),
  recovery_notes: z.string(),
  action_items: z.array(z.string()),
  weekly_grade: z.enum(["A", "B", "C", "D"]),
});

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weeklyReportEnabled =
    process.env.NEXT_PUBLIC_ENABLE_WEEKLY_REPORT === "true";
  if (!weeklyReportEnabled) {
    return NextResponse.json({ skipped: true, reason: "Feature disabled" });
  }

  const provider = getAnthropicProvider();
  if (!provider) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service client unavailable" },
      { status: 503 },
    );
  }

  // Calculate week boundaries (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Find users who trained this week
  const { data: activeUsers, error: usersErr } = await supabase
    .from("workout_sessions")
    .select("user_id")
    .eq("status", "completed")
    .gte("completed_at", weekStart.toISOString())
    .lt("completed_at", weekEnd.toISOString());

  if (usersErr) {
    logger.error("Weekly report: failed to fetch active users:", usersErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const uniqueUserIds = [...new Set((activeUsers ?? []).map((u) => u.user_id))];
  let generated = 0;
  let errors = 0;

  for (const userId of uniqueUserIds.slice(0, 50)) {
    try {
      // Get weekly training summary
      const { data: summary, error: rpcErr } = await supabase.rpc(
        "get_weekly_training_summary",
        {
          p_user_id: userId,
          p_week_start: weekStartStr,
          p_week_end: weekEndStr,
        },
      );

      if (rpcErr || !summary) {
        logger.error(`Weekly report RPC error for ${userId}:`, rpcErr);
        errors++;
        continue;
      }

      // Get nutrition compliance (7 days)
      let nutritionCompliance = null;
      try {
        const { data: nc } = await supabase.rpc("get_nutrition_compliance", {
          p_user_id: userId,
          p_days: 7,
        });
        nutritionCompliance = nc;
      } catch {
        // Nutrition data optional
      }

      // Generate report via AI
      const contextMessage = JSON.stringify({
        week: `${weekStartStr} to ${weekEndStr}`,
        training: summary,
        nutrition_compliance: nutritionCompliance,
      });

      const { object: reportData } = await generateObject({
        model: provider(HAIKU),
        schema: ReportSchema,
        system: WEEKLY_REPORT_SYSTEM_PROMPT,
        prompt: `Generate a weekly training report:\n\n${contextMessage}`,
        maxOutputTokens: 1024,
      });

      const result = { data: reportData };

      // Upsert report
      const { error: upsertErr } = await (supabase as any)
        .from("weekly_reports")
        .upsert(
          {
            user_id: userId,
            week_start: weekStartStr,
            report_json: result.data,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,week_start" },
        );

      if (upsertErr) {
        logger.error(`Weekly report upsert error for ${userId}:`, upsertErr);
        errors++;
        continue;
      }

      // Send push notification (best effort)
      try {
        const { sendPushToUser } = await import(
          "@/lib/momentum/push-sender"
        );
        await sendPushToUser(userId, {
          title: "Weekly Report Ready",
          body: `Grade: ${result.data.weekly_grade} — ${result.data.highlights[0]}`,
          data: { screen: "reports" },
        });
      } catch {
        // Push is optional
      }

      generated++;
    } catch (err) {
      logger.error(`Weekly report error for ${userId}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    generated,
    errors,
    total_users: uniqueUserIds.length,
    week: weekStartStr,
  });
}
