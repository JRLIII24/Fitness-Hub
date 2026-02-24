"use client";

import { cn } from "@/lib/utils";

interface GpsStatusIndicatorProps {
  accuracy: number | null;
  className?: string;
}

export function GpsStatusIndicator({
  accuracy,
  className,
}: GpsStatusIndicatorProps) {
  let color = "bg-red-500";
  let label = "No GPS";

  if (accuracy !== null) {
    if (accuracy <= 10) {
      color = "bg-green-500";
      label = "Strong";
    } else if (accuracy <= 30) {
      color = "bg-yellow-500";
      label = "Fair";
    } else {
      color = "bg-red-500";
      label = "Weak";
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("h-2 w-2 rounded-full", color)} />
      <span className="text-xs text-muted-foreground">
        GPS: {label}
        {accuracy !== null && ` (±${Math.round(accuracy)}m)`}
      </span>
    </div>
  );
}
