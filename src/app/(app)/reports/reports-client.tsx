"use client";

import { BarChart3, FileText } from "lucide-react";
import { WeeklyReportCard } from "@/components/reports/weekly-report-card";

interface Report {
  id: string;
  week_start: string;
  report_json: {
    overview: string;
    highlights: string[];
    volume_analysis: string;
    muscle_balance: string;
    recovery_notes: string;
    action_items: string[];
    weekly_grade: "A" | "B" | "C" | "D";
  };
  generated_at: string;
}

export function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  if (initialReports.length === 0) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card/30">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">No Reports Yet</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Weekly reports are generated every Sunday based on your training data.
          Keep training and your first report will appear here!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-32 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/30">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Weekly Reports</h1>
          <p className="text-[11px] text-muted-foreground">
            AI-powered training analysis
          </p>
        </div>
      </div>

      {/* Report list */}
      <div className="space-y-3">
        {initialReports.map((report, i) => (
          <WeeklyReportCard
            key={report.id}
            weekStart={report.week_start}
            report={report.report_json}
            generatedAt={report.generated_at}
            defaultExpanded={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
