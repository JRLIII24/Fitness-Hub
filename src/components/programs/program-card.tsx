"use client";

import { motion } from "framer-motion";
import { Calendar, Dumbbell, Target, Clock, CheckCircle2, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProgramCardProps {
  id: string;
  name: string;
  description?: string | null;
  goal: string;
  weeks: number;
  daysPerWeek: number;
  status: string;
  currentWeek?: number;
  currentDay?: number;
  startedAt?: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/40", icon: <Clock className="size-3" /> },
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30", icon: <Dumbbell className="size-3" /> },
  completed: { label: "Completed", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30", icon: <CheckCircle2 className="size-3" /> },
  abandoned: { label: "Abandoned", color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border/30", icon: <Pause className="size-3" /> },
};

export function ProgramCard({
  id,
  name,
  description,
  goal,
  weeks,
  daysPerWeek,
  status,
  currentWeek,
  createdAt,
}: ProgramCardProps) {
  const s = statusConfig[status] || statusConfig.draft;
  const progress = status === "active" && currentWeek ? Math.round(((currentWeek - 1) / weeks) * 100) : status === "completed" ? 100 : 0;

  return (
    <Link href={`/programs/${id}`}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="rounded-2xl border border-border/60 bg-card/30 p-4 backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-bold text-foreground">{name}</h3>
            {description && (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border",
              s.color,
              s.bg,
              s.border,
            )}
          >
            {s.icon}
            {s.label}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Target className="size-3" />
            {goal}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Calendar className="size-3" />
            {weeks}w / {daysPerWeek}d
          </span>
        </div>

        {/* Progress bar (active/completed only) */}
        {(status === "active" || status === "completed") && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Progress
              </span>
              <span className="text-[10px] font-bold tabular-nums text-foreground">
                {status === "active" ? `Week ${currentWeek} of ${weeks}` : "Complete"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  status === "completed" ? "bg-sky-400" : "bg-emerald-400",
                )}
              />
            </div>
          </div>
        )}

        {/* Footer date */}
        <p className="mt-2.5 text-[9px] tabular-nums text-muted-foreground/50">
          Created {new Date(createdAt).toLocaleDateString()}
        </p>
      </motion.div>
    </Link>
  );
}
