/**
 * Jarvis TTS — ElevenLabs with Web Speech API fallback.
 *
 * Priority:
 *   1. ElevenLabs via POST /api/ai/tts  (if ELEVENLABS_API_KEY is configured)
 *   2. Web Speech API fallback           (free, browser-native, slightly robotic)
 *
 * To use ElevenLabs: set ELEVENLABS_API_KEY in .env.local
 * To use the free fallback: leave ELEVENLABS_API_KEY unset
 */

// ── Web Audio API state (ElevenLabs) ─────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentAbort: AbortController | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

// ── Web Speech API fallback ───────────────────────────────────────────────────

let selectedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  // 1. "Daniel" — British English male on macOS/iOS
  const daniel = voices.find((v) => v.name === "Daniel");
  if (daniel) return daniel;
  // 2. Any en-GB voice
  const enGB = voices.find((v) => v.lang === "en-GB");
  if (enGB) return enGB;
  // 3. en-US fallback
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) return enUS;
  // 4. Any English voice
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function ensureVoices(): Promise<void> {
  if (voicesLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      selectedVoice = pickVoice();
      voicesLoaded = true;
      resolve();
      return;
    }
    const handler = () => {
      selectedVoice = pickVoice();
      voicesLoaded = true;
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      if (!voicesLoaded) {
        selectedVoice = pickVoice();
        voicesLoaded = true;
        resolve();
      }
    }, 1500);
  });
}

function speakWithWebSpeech(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.lang = selectedVoice?.lang ?? "en-GB";
  utterance.rate = 0.88;
  utterance.pitch = 0.82;
  utterance.volume = 1;
  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  window.speechSynthesis.speak(utterance);
}

// ── Shared text cleaner ───────────────────────────────────────────────────────

function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n+/g, ". ")
    .trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── Speaking state callback ───────────────────────────────────────────────────

let _onSpeakingChange: ((speaking: boolean) => void) | null = null;

/** Register a callback that fires when speaking starts/stops. */
export function onSpeakingStateChange(cb: ((speaking: boolean) => void) | null): void {
  _onSpeakingChange = cb;
}

function setSpeaking(v: boolean) {
  _onSpeakingChange?.(v);
}

/** Cancel any currently-playing or in-flight speech */
export function stopSpeaking(): void {
  // Abort any pending ElevenLabs fetch
  currentAbort?.abort();
  currentAbort = null;

  // Stop any playing Web Audio node
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }

  // Stop any Web Speech API utterance
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  setSpeaking(false);
}

/**
 * Speak text using ElevenLabs if configured, otherwise fall back to
 * the browser's built-in Web Speech API (Daniel voice, British accent).
 */
export async function speakAsJarvis(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  stopSpeaking();

  // ── Attempt ElevenLabs ──────────────────────────────────────────────────
  const ctx = getAudioContext();
  if (ctx) {
    const abort = new AbortController();
    currentAbort = abort;

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
        signal: abort.signal,
      });

      if (abort.signal.aborted) return;

      if (res.ok) {
        // ElevenLabs succeeded — play via Web Audio API
        const arrayBuffer = await res.arrayBuffer();
        if (abort.signal.aborted || !arrayBuffer.byteLength) return;

        if (ctx.state === "suspended") await ctx.resume();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (abort.signal.aborted) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        currentSource = source;
        currentAbort = null;
        source.onended = () => {
          if (currentSource === source) currentSource = null;
          setSpeaking(false);
        };
        setSpeaking(true);
        source.start();
        return; // done — don't fall through to Web Speech
      }

      // 503 = API key not configured → fall through to Web Speech API
      // Any other error → also fall through
      currentAbort = null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      currentAbort = null;
      // Network error → fall through to Web Speech API
    }
  }

  // ── Fallback: Web Speech API ────────────────────────────────────────────
  await ensureVoices();
  speakWithWebSpeech(cleaned);
}
