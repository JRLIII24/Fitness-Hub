"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/stores/run-store";

export default function RunRoutePage() {
  const router = useRouter();
  const lifecycleState = useRunStore((s) => s.lifecycleState);

  useEffect(() => {
    if (
      lifecycleState === "running" ||
      lifecycleState === "paused" ||
      lifecycleState === "auto_paused"
    ) {
      router.replace("/run/active");
      return;
    }

    if (lifecycleState === "finishing" || lifecycleState === "saving") {
      router.replace("/run/finish");
      return;
    }

    router.replace("/run/start");
  }, [lifecycleState, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
