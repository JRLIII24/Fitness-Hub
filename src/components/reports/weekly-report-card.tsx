"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  TrendingUp,
  Target,
  Activity,
  Heart,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WeeklyReport {
  overview: string;
  highlights: string[];
  volume_analysis: string;
  muscle_balance: string;
  recovery_notes: string;
  action_items: string[];
  weekly_grade: "A" | "B" | "C" | "D";
}

interface WeeklyReportCardProps {
  weekStart: string;
  report: WeeklyReport;
  generatedAt: string;
  defaultExpanded?: boolean;
}

const gradeConfig = {
  A: { color: "text-emerald-400", bg: "bg-emerald-400/15", border: "border-emerald-400/30" },
  B: { color: "text-sky-400", bg: "bg-sky-400/15", border: "border-sky-400/30" },
  C: { color: "text-amber-400", bg: "bg-amber-400/15", border: "border-amber-400/30" },
  D: { color: "text-red-400", bg: "bg-red-400/15", border: "border-red-400/30" },
};

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} — ${fmt(end)}`;
}

export function WeeklyReportCard({
  weekStart,
  report,
  defaultExpanded = false,
}: WeeklyReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const grade = gradeConfig[report.weekly_grade];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              grade.bg,
              grade.border,
            )}
          >
            <span className={cn("text-lg font-black", grade.color)}>
              {report.weekly_grade}
            </span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">
              {formatWeekRange(weekStart)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
              {report.highlights[0]}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/40 px-4 pb-4 pt-3">
              {/* Overview */}
              <p className="text-[12px] leading-relaxed text-foreground/90">
                {report.overview}
              </p>

              {/* Highlights */}
              <div className="flex flex-wrap gap-1.5">
                {report.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Analysis sections */}
              <div className="space-y-3">
                <Section icon={TrendingUp} label="Volume" text={report.volume_analysis} />
                <Section icon={Target} label="Muscle Balance" text={report.muscle_balance} />
                <Section icon={Heart} label="Recovery" text={report.recovery_notes} />
              </div>

              {/* Action Items */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Next Week
                  </span>
                </div>
                <div className="space-y-1.5">
                  {report.action_items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border/50 bg-card/40 p-2"
                    >
                      <Activity className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Section({
  icon: Icon,
  label,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80">{text}</p>
    </div>
  );
}
