/**
 * AI Parse-Sets API (Multi-set)
 * POST /api/ai/parse-sets
 *
 * Accepts a voice transcript and uses AI to extract MULTIPLE sets
 * from conversational input. Powers batch voice-to-set logging.
 *
 * Rate limited to 50 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import type { ParsedSet } from "../parse-set/route";

const DAILY_LIMIT = 50;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a gym set parser. Parse multiple sets from conversational input. The user may describe several sets in sequence.

For each set, extract:
- weight: the number representing load/weight. null if not mentioned.
- reps: the number of repetitions. null if not mentioned.
- unit: "kg" or "lbs". Infer from context (e.g. "pounds" → "lbs", "kilos" → "kg"). null if ambiguous.
- set_type: "warmup", "working", "dropset", or "failure". Infer from keywords. null if not mentioned.
- rpe: Rate of Perceived Exertion (1-10 scale). Extract from "at RPE 8", "RPE 9", "rate 7". null if not mentioned.
- rir: Reps in Reserve. Extract from "had 2 left", "2 in the tank", "RIR 3", "about 1 left". null if not mentioned.
- notes: Any contextual comments like "felt heavy", "easy", "grip slipping". null if none.

Examples:
"135 for 10, then 185 for 8, then 205 for 5 to failure"
→ [
    {"weight":135,"reps":10,"unit":"lbs","set_type":"working","rpe":null,"rir":null,"notes":null},
    {"weight":185,"reps":8,"unit":"lbs","set_type":"working","rpe":null,"rir":null,"notes":null},
    {"weight":205,"reps":5,"unit":"lbs","set_type":"failure","rpe":null,"rir":null,"notes":null}
  ]

"Did 3 sets of 10 at 100 kilos"
→ [
    {"weight":100,"reps":10,"unit":"kg","set_type":"working","rpe":null,"rir":null,"notes":null},
    {"weight":100,"reps":10,"unit":"kg","set_type":"working","rpe":null,"rir":null,"notes":null},
    {"weight":100,"reps":10,"unit":"kg","set_type":"working","rpe":null,"rir":null,"notes":null}
  ]

"225 for 5 at RPE 8, then dropped to 185 for 8 had about 2 left"
→ [
    {"weight":225,"reps":5,"unit":"lbs","set_type":"working","rpe":8,"rir":null,"notes":null},
    {"weight":185,"reps":8,"unit":"lbs","set_type":"dropset","rpe":null,"rir":2,"notes":null}
  ]

Respond ONLY with a JSON object containing a "sets" array of set objects.`;

export async function POST(request: Request) {
  try {
    const ai = getAIClient();
    if (!ai) return NextResponse.json(null);

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:parse-sets:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
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
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Parse all sets from this spoken workout transcript:\n"${transcript.trim()}"`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "null");

    // Accept either { sets: [...] } or a raw array
    const sets: ParsedSet[] | null = Array.isArray(raw)
      ? raw
      : raw?.sets && Array.isArray(raw.sets)
        ? raw.sets
        : null;

    if (!sets) {
      return NextResponse.json(null);
    }

    return NextResponse.json({ sets });
  } catch (error) {
    logger.error("AI parse-sets error:", error);
    return NextResponse.json(null);
  }
}
