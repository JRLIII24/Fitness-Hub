import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { RUN_FEATURE_ENABLED } from "@/lib/features";

export default function RunLayout({ children }: { children: ReactNode }) {
  if (!RUN_FEATURE_ENABLED) {
    redirect("/workout");
  }

  return <>{children}</>;
}
