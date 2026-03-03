/**
 * AI Parse-Set API
 * POST /api/ai/parse-set
 *
 * Accepts a voice transcript and uses AI to extract set data
 * (weight, reps, unit, set_type). Powers voice-to-set logging.
 *
 * Rate limited to 50 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";

export interface ParsedSet {
  weight: number | null;
  reps: number | null;
  unit: "kg" | "lbs" | null;
  set_type: "warmup" | "working" | "dropset" | "failure" | null;
}

const DAILY_LIMIT = 50;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ai = getAIClient();
    if (!ai) return NextResponse.json(null);

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:parse-set:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const transcript: string | undefined = body?.transcript;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a gym set parser. Extract structured data from a spoken workout transcript.

Rules:
- weight: the number representing load/weight. null if not mentioned.
- reps: the number of repetitions. null if not mentioned.
- unit: "kg" or "lbs". Infer from context (e.g. "pounds" → "lbs", "kilos" → "kg"). null if ambiguous.
- set_type: "warmup", "working", "dropset", or "failure". Infer from keywords like "warm up", "drop set", "to failure". null if not mentioned.

Respond with JSON containing exactly these fields: weight, reps, unit, set_type.

Examples:
- "135 for 8" → {"weight": 135, "reps": 8, "unit": null, "set_type": null}
- "225 pounds for 5 reps" → {"weight": 225, "reps": 5, "unit": "lbs", "set_type": null}
- "60 kilos 10 reps warm up" → {"weight": 60, "reps": 10, "unit": "kg", "set_type": "warmup"}
- "bodyweight 12 reps to failure" → {"weight": null, "reps": 12, "unit": null, "set_type": "failure"}
- "drop set 100 for 6" → {"weight": 100, "reps": 6, "unit": null, "set_type": "dropset"}`,
        },
        {
          role: "user",
          content: `Parse this spoken workout set transcript:\n"${transcript.trim()}"`,
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "null") as ParsedSet;
    return NextResponse.json(parsed);
  } catch (error) {
    logger.error("AI parse-set error:", error);
    return NextResponse.json(null);
  }
}
