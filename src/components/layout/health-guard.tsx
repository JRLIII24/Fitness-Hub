"use client";

import { useEffect, useState } from "react";
import { RefreshCw, LogOut, Trash2, Copy, Check } from "lucide-react";

export function HealthGuard() {
  const [broken, setBroken] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const check = async () => {
      // Check if the app hydrated properly
      const nextRoot = document.getElementById("__next");
      const hasContent = nextRoot ? nextRoot.childElementCount > 0 : true;

      if (hasContent) {
        // App hydrated fine — no need for health check
        return;
      }

      // Hydration looks broken — verify with health check
      try {
        const res = await fetch("/api/health", {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        if (res.ok) return; // Server is fine, hydration issue might self-resolve
      } catch {
        // Server also unreachable — show recovery
      }

      setBroken(true);
    };

    // Delay check to give hydration time to complete
    const timeout = setTimeout(check, 3000);
    return () => clearTimeout(timeout);
  }, []);

  if (!broken) return null;

  const handleRetry = () => window.location.reload();

  const handleSignOut = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Clear cookies manually as fallback
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
    }
    window.location.href = "/login";
  };

  const handleClearData = async () => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try {
      const dbs = await indexedDB.databases();
      dbs.forEach((db) => { if (db.name) indexedDB.deleteDatabase(db.name); });
    } catch {}
    window.location.reload();
  };

  const handleCopySupport = async () => {
    const code = JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      online: navigator.onLine,
    });
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center"><RefreshCw className="h-10 w-10 text-muted-foreground" /></div>
        <h1 className="text-lg font-bold text-foreground">FitHub needs attention</h1>
        <p className="text-sm text-muted-foreground">
          The app couldn&apos;t load properly. Try the options below to recover.
        </p>

        <div className="space-y-2 pt-2">
          <button
            onClick={handleRetry}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            <RefreshCw className="size-4" />
            Retry
          </button>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-6 py-3 text-sm font-semibold text-foreground"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>

          <button
            onClick={handleClearData}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 px-6 py-3 text-sm font-semibold text-destructive"
          >
            <Trash2 className="size-4" />
            Clear App Data
          </button>

          <button
            onClick={handleCopySupport}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border/40 px-6 py-2.5 text-xs font-medium text-muted-foreground"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy Support Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
