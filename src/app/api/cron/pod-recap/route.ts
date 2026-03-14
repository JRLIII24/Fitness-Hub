/**
 * Pod Season Recap Cron
 * GET /api/cron/pod-recap
 *
 * Generates AI-powered monthly recaps for all active pods.
 * Scheduled via vercel.json (monthly).
 *
 * Model: Haiku
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { POD_RECAP_SYSTEM_PROMPT } from "@/lib/ai-prompts/pod-recap";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import { z } from "zod";

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
const PodRecapSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  mvp_user_id: z.string().optional(),
});

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!POD_CHALLENGES_ENABLED) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
  }

  const provider = getAnthropicProvider();
  if (!provider) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }

  try {
    const supabase = await createClient();

    // Fetch all pods with at least 2 active members and season_score > 0
    const { data: pods, error: podsError } = await supabase
      .from("accountability_pods")
      .select("id, name, arena_level, season_score, season_start_date")
      .gt("season_score", 0);

    if (podsError) {
      logger.error("Pod recap: failed to fetch pods", podsError);
      return NextResponse.json(
        { error: "Failed to fetch pods" },
        { status: 500 },
      );
    }

    if (!pods || pods.length === 0) {
      return NextResponse.json({ recaps_generated: 0 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const recapDate = now.toISOString().split("T")[0];

    let recapsGenerated = 0;

    for (const pod of pods) {
      try {
        // Fetch active members
        const { data: members, error: membersError } = await supabase
          .from("pod_members")
          .select("user_id, profiles!inner(display_name)")
          .eq("pod_id", pod.id)
          .eq("status", "active");

        if (membersError || !members || members.length < 2) continue;

        const memberIds = members.map((m) => m.user_id);

        // Count completed workout sessions per member this month
        const { data: sessions } = await supabase
          .from("workout_sessions")
          .select("user_id, total_volume_kg")
          .in("user_id", memberIds)
          .gte("created_at", monthStart)
          .not("completed_at", "is", null);

        // Aggregate per member
        const memberStats = new Map<
          string,
          { workouts: number; volume: number; name: string }
        >();

        for (const m of members) {
          const profile = m.profiles as unknown as {
            display_name: string | null;
          };
          memberStats.set(m.user_id, {
            workouts: 0,
            volume: 0,
            name: profile?.display_name || "Unknown",
          });
        }

        if (sessions) {
          for (const s of sessions) {
            const stat = memberStats.get(s.user_id);
            if (stat) {
              stat.workouts += 1;
              stat.volume += s.total_volume_kg || 0;
            }
          }
        }

        // Count streak saves from streak_risk_alerts this month
        const { count: streakSaves } = await supabase
          .from("streak_risk_alerts")
          .select("id", { count: "exact", head: true })
          .in("user_id", memberIds)
          .gte("created_at", monthStart);

        // Build context string
        const memberLines = Array.from(memberStats.entries())
          .map(
            ([, stat]) =>
              `${stat.name}: ${stat.workouts} workouts, ${Math.round(stat.volume)} kg total volume`,
          )
          .join("\n");

        const tierLabel =
          pod.arena_level >= 4
            ? "Platinum"
            : pod.arena_level >= 3
              ? "Gold"
              : pod.arena_level >= 2
                ? "Silver"
                : "Bronze";

        const context = `Pod: ${pod.name}
Arena Tier: ${tierLabel}
Season Score: ${pod.season_score}
Month: ${now.toLocaleString("en-US", { month: "long", year: "numeric" })}
Streak Saves This Month: ${streakSaves || 0}

Member Stats This Month:
${memberLines}`;

        // Generate recap via AI
        const { object: recap } = await generateObject({
          model: provider(HAIKU),
          schema: PodRecapSchema,
          system: POD_RECAP_SYSTEM_PROMPT,
          prompt: context,
          maxOutputTokens: 1024,
        });

        // Build stats JSON for storage
        const stats = Object.fromEntries(
          Array.from(memberStats.entries()).map(([userId, stat]) => [
            userId,
            { workouts: stat.workouts, volume: Math.round(stat.volume) },
          ]),
        );

        // Upsert into pod_season_recaps
        const { error: upsertError } = await supabase
          .from("pod_season_recaps")
          .upsert(
            {
              pod_id: pod.id,
              recap_date: recapDate,
              summary: recap.summary,
              highlights: recap.highlights,
              mvp_user_id: recap.mvp_user_id || null,
              stats,
            },
            { onConflict: "pod_id,recap_date" },
          );

        if (upsertError) {
          logger.error(
            `Pod recap: upsert failed for pod ${pod.id}`,
            upsertError,
          );
          continue;
        }

        recapsGenerated++;
      } catch (podErr) {
        logger.error(`Pod recap: error for pod ${pod.id}`, podErr);
        continue;
      }
    }

    return NextResponse.json({ recaps_generated: recapsGenerated });
  } catch (err) {
    logger.error("Pod recap cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
