"use client";

import { useEffect, useRef } from "react";
import { hideSplash } from "@/lib/capacitor/splash";

export function SplashDismisser() {
  const dismissed = useRef(false);

  useEffect(() => {
    const dismiss = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      hideSplash();
    };

    // Normal path: hide when component mounts (layout rendered)
    dismiss();

    // Safety timeout: if something delays mounting, force hide after 2.5s
    const timeout = setTimeout(dismiss, 2500);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
