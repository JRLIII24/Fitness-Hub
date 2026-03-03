"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export function ClientCrashReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logger.error("[Unhandled Error]", event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      logger.error("[Unhandled Rejection]", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
