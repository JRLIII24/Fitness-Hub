"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { glassMotionVariants } from "@/lib/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Keep first render deterministic between server and client.
  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={prefersReducedMotion ? { opacity: 1 } : glassMotionVariants.glassReveal.initial}
        animate={prefersReducedMotion ? { opacity: 1 } : glassMotionVariants.glassReveal.animate}
        exit={prefersReducedMotion ? { opacity: 1 } : glassMotionVariants.glassReveal.exit}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
