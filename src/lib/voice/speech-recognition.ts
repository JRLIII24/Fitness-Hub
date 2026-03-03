/**
 * Speech Recognition Service
 *
 * Uses @capacitor-community/speech-recognition native plugin as PRIMARY on
 * mobile (Apple WKWebView blocks Web Speech API). Falls back to the Web
 * Speech API only when running in a plain browser (`Capacitor.getPlatform() === "web"`).
 *
 * Returns `{ transcript: string; isFinal: boolean }` via callback.
 */

import { Capacitor } from "@capacitor/core";

/* ---------- Types -------------------------------------------------------- */

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

type OnResult = (result: SpeechResult) => void;
type OnError = (error: string) => void;

/* ---------- Service ------------------------------------------------------ */

export class SpeechRecognitionService {
  private _active = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private webRecognition: any = null;
  private nativePlugin: typeof import("@capacitor-community/speech-recognition").SpeechRecognition | null =
    null;
  private nativeListenerId: string | null = null;

  /** Whether the recogniser is currently listening. */
  get active(): boolean {
    return this._active;
  }

  /* ---------------------------------------------------------------------- */
  /*  start                                                                  */
  /* ---------------------------------------------------------------------- */

  async start(onResult: OnResult, onError: OnError): Promise<void> {
    if (this._active) return;

    if (Capacitor.isNativePlatform()) {
      await this.startNative(onResult, onError);
    } else {
      this.startWeb(onResult, onError);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  stop                                                                   */
  /* ---------------------------------------------------------------------- */

  async stop(): Promise<void> {
    if (!this._active) return;

    if (Capacitor.isNativePlatform()) {
      await this.stopNative();
    } else {
      this.stopWeb();
    }

    this._active = false;
  }

  /* ---------------------------------------------------------------------- */
  /*  Native (Capacitor plugin)                                              */
  /* ---------------------------------------------------------------------- */

  private async loadNativePlugin() {
    if (!this.nativePlugin) {
      // Dynamic import so the native dependency is not bundled in web builds.
      const mod = await import("@capacitor-community/speech-recognition");
      this.nativePlugin = mod.SpeechRecognition;
    }
    return this.nativePlugin;
  }

  private async startNative(onResult: OnResult, onError: OnError): Promise<void> {
    try {
      const plugin = await this.loadNativePlugin();

      // Request permission if needed
      const { speechRecognition } = await plugin.checkPermissions();
      if (speechRecognition !== "granted") {
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== "granted") {
          onError("Microphone permission denied");
          return;
        }
      }

      this._active = true;

      // Listen for partial results via the plugin event system
      await plugin.addListener("partialResults", (data: { matches: string[] }) => {
        const transcript = data.matches?.[0] ?? "";
        if (transcript) {
          onResult({ transcript, isFinal: false });
        }
      });

      // Start recognition
      await plugin.start({
        language: "en-US",
        partialResults: true,
        popup: false,
      });

      // The plugin fires a result event when recognition completes
      await plugin.addListener("listeningState", (state: { status: string }) => {
        if (state.status === "stopped") {
          this._active = false;
        }
      });
    } catch (err) {
      this._active = false;
      onError(err instanceof Error ? err.message : "Native speech recognition failed");
    }
  }

  private async stopNative(): Promise<void> {
    try {
      const plugin = await this.loadNativePlugin();
      await plugin.stop();
      await plugin.removeAllListeners();
    } catch {
      // Swallow — stop is best-effort.
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Web Speech API fallback                                                */
  /* ---------------------------------------------------------------------- */

  private startWeb(onResult: OnResult, onError: OnError): void {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      onError("Speech recognition is not supported in this browser");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionCtor as any)();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (last) {
        onResult({
          transcript: last[0].transcript.trim(),
          isFinal: last.isFinal,
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      this._active = false;
      onError(event.error ?? "Web speech recognition error");
    };

    recognition.onend = () => {
      this._active = false;
    };

    this.webRecognition = recognition;
    this._active = true;
    recognition.start();
  }

  private stopWeb(): void {
    try {
      this.webRecognition?.stop();
    } catch {
      // Swallow — stop is best-effort.
    }
    this.webRecognition = null;
  }
}
