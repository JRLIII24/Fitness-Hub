"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, ServerCrash } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { motionDurations, motionEasings } from "@/lib/motion";

export function OfflineBanner() {
  const { online } = useNetworkStatus();
  const [serverReachable, setServerReachable] = useState(true);
  const failCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only ping when browser thinks we're online
    if (!online) {
      setServerReachable(true); // reset — the offline banner handles this case
      failCountRef.current = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const ping = async () => {
      try {
        const res = await fetch("/api/health", {
          signal: AbortSignal.timeout(3000),
          cache: "no-store",
        });
        if (res.ok) {
          failCountRef.current = 0;
          setServerReachable(true);
        } else {
          failCountRef.current++;
        }
      } catch {
        failCountRef.current++;
      }
      if (failCountRef.current >= 3) {
        setServerReachable(false);
      }
    };

    // Initial ping
    ping();
    // Check every 10s while online
    intervalRef.current = setInterval(ping, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [online]);

  const showOffline = !online;
  const showServerDown = online && !serverReachable;
  const showBanner = showOffline || showServerDown;

  const Icon = showOffline ? WifiOff : ServerCrash;
  const message = showOffline
    ? "You're offline. Changes will sync when reconnected."
    : "Server unavailable. Some features may not work.";

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            duration: motionDurations.toggle,
            ease: motionEasings.primary,
          }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 bg-destructive/90 px-4 py-2 text-[11px] font-semibold text-destructive-foreground backdrop-blur-sm">
            <Icon className="size-3.5 shrink-0" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
