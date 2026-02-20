import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  icon,
  value,
  label,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className={cn("border-border/60 bg-card/80", className)}>
      <CardContent className="flex flex-col items-center justify-center px-2 py-4">
        <span className="mb-1">{icon}</span>
        <span className={cn("text-2xl font-bold tabular-nums", valueClassName)}>{value}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}
