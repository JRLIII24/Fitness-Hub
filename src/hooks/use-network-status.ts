"use client";

import { useState, useEffect, useCallback } from "react";

type NetworkStatus = {
  online: boolean;
  connectionType: string | null;
};

export function useNetworkStatus(): NetworkStatus {
  // Always initialize as online to match SSR output and avoid hydration mismatch.
  // The real value is set in useEffect after mount.
  const [status, setStatus] = useState<NetworkStatus>({
    online: true,
    connectionType: null,
  });

  const initNative = useCallback(async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const current = await Network.getStatus();
      setStatus({ online: current.connected, connectionType: current.connectionType });

      Network.addListener("networkStatusChange", (s) => {
        setStatus({ online: s.connected, connectionType: s.connectionType });
      });
    } catch {
      // Not in Capacitor — browser events handle it below
    }
  }, []);

  useEffect(() => {
    // Set real browser value on mount
    setStatus((prev) => ({ ...prev, online: navigator.onLine }));

    initNative();

    const goOnline = () => setStatus((prev) => ({ ...prev, online: true }));
    const goOffline = () => setStatus((prev) => ({ ...prev, online: false }));

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [initNative]);

  return status;
}
