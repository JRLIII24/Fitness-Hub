import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = React.memo(function SectionCard({ children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden glass-surface shimmer-target rounded-2xl",
        className
      )}
    >
      {children}
    </div>
  );
});
