"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const isNetworkError =
    error.message.toLowerCase().includes("network") ||
    error.message.toLowerCase().includes("fetch") ||
    error.message.toLowerCase().includes("load failed");

  const Icon = isNetworkError ? WifiOff : AlertTriangle;

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/30 p-8">
        <Icon className="mx-auto mb-4 size-10 text-destructive" />
        <h2 className="mb-2 text-[13px] font-bold text-foreground">
          {isNetworkError ? "Connection lost" : "Something went wrong"}
        </h2>
        <p className="mb-6 text-[12px] text-muted-foreground">
          {isNetworkError
            ? "Check your connection and try again."
            : error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[12px] font-bold text-primary-foreground"
        >
          <RefreshCw className="size-3.5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
