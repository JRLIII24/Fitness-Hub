/**
 * Text-to-Speech API
 * POST /api/ai/tts
 *
 * Proxies to ElevenLabs REST API directly (no SDK) so the API key stays
 * server-side. Returns audio/mpeg suitable for Web Audio API playback.
 *
 * Voice: configurable via ELEVENLABS_VOICE_ID env var
 * Default voice: 6OzrBCQf8cjERkYgzSg
 * Model: eleven_multilingual_v2
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { z } from "zod";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "6OzrBCQf8cjERkYgzSg8";
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
  const { response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

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
    const res = await fetch(`${ELEVENLABS_API_URL}/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleaned,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      console.error("ElevenLabs API error:", res.status, err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 500 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return NextResponse.json({ error: "TTS generation failed" }, { status: 500 });
  }
}
