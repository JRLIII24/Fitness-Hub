"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SpeechRecognitionService, type SpeechResult } from "@/lib/voice/speech-recognition";

interface UseVoiceCommandsReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

export function useVoiceCommands(): UseVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<SpeechRecognitionService | null>(null);

  const stopListening = useCallback(async () => {
    if (serviceRef.current?.active) {
      await serviceRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setTranscript("");
    setError(null);

    if (!serviceRef.current) {
      serviceRef.current = new SpeechRecognitionService();
    }

    const service = serviceRef.current;

    const handleResult = (result: SpeechResult) => {
      setTranscript(result.transcript);
      // Do NOT auto-stop on final — user must tap the button again to stop
    };

    const handleError = (err: string) => {
      setError(err);
      setIsListening(false);
    };

    setIsListening(true);

    service.start(handleResult, handleError).catch((err) => {
      handleError(err instanceof Error ? err.message : "Failed to start speech recognition");
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.stop().catch(() => {});
    };
  }, []);

  return { isListening, transcript, startListening, stopListening, error };
}
