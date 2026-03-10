/**
 * Text-to-Speech API — Streaming
 * POST /api/ai/tts
 *
 * Proxies to ElevenLabs streaming endpoint. Returns chunked audio/mpeg
 * that can start playing before the full audio is generated.
 *
 * Voice: configurable via ELEVENLABS_VOICE_ID env var
 * Model: eleven_multilingual_v2
 * Rate limit: 100/day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const DAILY_LIMIT = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "kPzsL2i3teMYv0FxEYQ6";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const BodySchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  const allowed = await rateLimit(
    `ai:tts:${user.id}`,
    DAILY_LIMIT,
    ONE_DAY_MS,
  );
  if (!allowed) {
    return NextResponse.json({ limitReached: true }, { status: 429 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Strip markdown symbols that would be spoken literally
  const cleaned = parsed.data.text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n+/g, ". ")
    .trim();

  if (!cleaned) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  try {
    // Use the streaming endpoint for lower latency
    const res = await fetch(`${ELEVENLABS_API_URL}/${VOICE_ID}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleaned,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
        optimize_streaming_latency: 3,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      console.error("ElevenLabs API error:", res.status, err);
      return NextResponse.json(
        { error: "TTS generation failed" },
        { status: 500 },
      );
    }

    // Stream the response body directly to the client
    if (!res.body) {
      return NextResponse.json(
        { error: "No audio stream" },
        { status: 500 },
      );
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 },
    );
  }
}
