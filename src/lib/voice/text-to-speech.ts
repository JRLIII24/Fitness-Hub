/**
 * Jarvis TTS — ElevenLabs with Web Speech API fallback.
 *
 * Supports two modes:
 *   1. speakAsJarvis(text)           – speak full text at once
 *   2. createSentenceQueue()         – streaming: queue sentences as they arrive,
 *                                      plays them sequentially with overlap prefetch
 *
 * Priority:
 *   1. ElevenLabs via POST /api/ai/tts  (if ELEVENLABS_API_KEY is configured)
 *   2. Web Speech API fallback           (free, browser-native, slightly robotic)
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
  const daniel = voices.find((v) => v.name === "Daniel");
  if (daniel) return daniel;
  const enGB = voices.find((v) => v.lang === "en-GB");
  if (enGB) return enGB;
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) return enUS;
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

// ── Speaking state callback ───────────────────────────────────────────────────

let _onSpeakingChange: ((speaking: boolean) => void) | null = null;

/** Register a callback that fires when speaking starts/stops. */
export function onSpeakingStateChange(
  cb: ((speaking: boolean) => void) | null,
): void {
  _onSpeakingChange = cb;
}

function setSpeaking(v: boolean) {
  _onSpeakingChange?.(v);
}

// ── Stop ─────────────────────────────────────────────────────────────────────

/** Cancel any currently-playing or in-flight speech */
export function stopSpeaking(): void {
  currentAbort?.abort();
  currentAbort = null;

  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* already stopped */
    }
    currentSource = null;
  }

  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Stop any active sentence queue
  if (_activeSentenceQueue) {
    _activeSentenceQueue.cancel();
    _activeSentenceQueue = null;
  }

  setSpeaking(false);
}

// ── Single-shot speak (unchanged API) ────────────────────────────────────────

/**
 * Speak text using ElevenLabs if configured, otherwise fall back to
 * the browser's built-in Web Speech API.
 */
export async function speakAsJarvis(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  stopSpeaking();

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
        return;
      }

      currentAbort = null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      currentAbort = null;
    }
  }

  await ensureVoices();
  speakWithWebSpeech(cleaned);
}

// ── Sentence-based streaming TTS queue ───────────────────────────────────────
// Designed for streaming coach responses: as each sentence completes,
// it's sent to ElevenLabs and queued for playback. The first sentence
// starts playing immediately; subsequent ones overlap prefetch.

let _activeSentenceQueue: SentenceQueue | null = null;

interface SentenceQueue {
  /** Push a complete sentence to be spoken. */
  push(sentence: string): void;
  /** Signal that no more sentences will arrive. */
  finish(): void;
  /** Cancel all pending/playing audio. */
  cancel(): void;
}

/**
 * Create a sentence-based TTS queue. Each sentence is fetched and played
 * in order with prefetch overlap for seamless playback.
 */
export function createSentenceQueue(): SentenceQueue {
  // Cancel any existing queue
  if (_activeSentenceQueue) {
    _activeSentenceQueue.cancel();
  }

  const ctx = getAudioContext();
  let cancelled = false;
  let finished = false;
  const pending: string[] = [];
  let isPlaying = false;

  async function fetchAudio(
    text: string,
    signal: AbortSignal,
  ): Promise<AudioBuffer | null> {
    if (!ctx) return null;
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanForSpeech(text) }),
        signal,
      });
      if (!res.ok || signal.aborted) return null;
      const arrayBuf = await res.arrayBuffer();
      if (signal.aborted || !arrayBuf.byteLength) return null;
      return await ctx.decodeAudioData(arrayBuf);
    } catch {
      return null;
    }
  }

  function playBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      if (!ctx || cancelled) {
        resolve();
        return;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      currentSource = source;
      source.onended = () => {
        if (currentSource === source) currentSource = null;
        resolve();
      };
      source.start();
    });
  }

  async function processQueue() {
    if (isPlaying || cancelled) return;
    isPlaying = true;
    setSpeaking(true);

    const abort = new AbortController();
    currentAbort = abort;

    while (pending.length > 0 && !cancelled) {
      const sentence = pending.shift()!;

      // Prefetch next sentence while current one plays
      const nextSentence = pending.length > 0 ? pending[0] : null;
      const [currentBuf, nextBufPromise] = await Promise.all([
        fetchAudio(sentence, abort.signal),
        nextSentence
          ? fetchAudio(nextSentence, abort.signal)
          : Promise.resolve(null),
      ]);

      if (cancelled || abort.signal.aborted) break;

      if (currentBuf) {
        await playBuffer(currentBuf);
      }

      if (cancelled || abort.signal.aborted) break;

      // If we prefetched the next one, play it directly
      if (nextBufPromise && pending.length > 0 && pending[0] === nextSentence) {
        pending.shift(); // remove the prefetched sentence
        const nextBuf = nextBufPromise;
        if (nextBuf && !cancelled) {
          await playBuffer(nextBuf);
        }
      }
    }

    isPlaying = false;
    currentAbort = null;
    if (!cancelled) setSpeaking(false);
  }

  const queue: SentenceQueue = {
    push(sentence: string) {
      if (cancelled || finished) return;
      const cleaned = cleanForSpeech(sentence);
      if (!cleaned || cleaned.length < 2) return;
      pending.push(cleaned);
      processQueue();
    },
    finish() {
      finished = true;
    },
    cancel() {
      cancelled = true;
      pending.length = 0;
      currentAbort?.abort();
      currentAbort = null;
      if (currentSource) {
        try {
          currentSource.stop();
        } catch {
          /* */
        }
        currentSource = null;
      }
      setSpeaking(false);
    },
  };

  _activeSentenceQueue = queue;
  return queue;
}

// ── Sentence boundary detection ──────────────────────────────────────────────

/**
 * Detect sentence boundaries in streaming text.
 * Returns [completeSentences, remainder].
 */
export function extractSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  // Match sentences ending with . ! or ? followed by space/end
  // Also match at common pause points like : and —
  const re = /[^.!?\n]+[.!?]+(?:\s|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    sentences.push(match[0].trim());
    lastIndex = re.lastIndex;
  }

  const remainder = text.slice(lastIndex);
  return [sentences, remainder];
}
