"use client";

import { useIsOnline } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";

interface PresenceDotProps {
  userId: string;
  size?: "sm" | "md";
  className?: string;
}

export function PresenceDot({ userId, size = "sm", className }: PresenceDotProps) {
  const online = useIsOnline(userId);

  return (
    <span
      className={cn(
        "rounded-full border-2 border-background",
        size === "sm" ? "size-2.5" : "size-3.5",
        online ? "bg-green-500" : "bg-muted-foreground/40",
        className
      )}
      title={online ? "Online" : "Offline"}
    />
  );
}
