"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
    Download,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    CalendarDays,
    ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

type Status = { type: "success" | "error"; text: string } | null;

const FORMAT_OPTIONS = [
    {
        id: "csv" as const,
        icon: FileSpreadsheet,
        label: "Spreadsheet (CSV)",
        description:
            "Every set, rep, and weight in a raw table. Best for Excel, Google Sheets, or your own analysis.",
        badge: "Raw data",
        badgeColor: "text-blue-500 bg-blue-500/10",
    },
    {
        id: "pdf" as const,
        icon: FileText,
        label: "Progress Report (PDF)",
        description:
            "A clean, formatted report with your workout sessions, exercise summaries, and personal records. Easy to read and share.",
        badge: "Human-friendly",
        badgeColor: "text-emerald-500 bg-emerald-500/10",
    },
];

export function ExportDataCard() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);
    const [status, setStatus] = useState<Status>(null);
    const { preference } = useUnitPreferenceStore();

    const rangeLabel = dateRange?.from
        ? dateRange.to
            ? `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
            : `From ${format(dateRange.from, "MMM d, yyyy")}`
        : "All time";

    const handleExportCsv = async () => {
        const params = new URLSearchParams({ format: "csv" });
        if (dateRange?.from) params.append("start", dateRange.from.toISOString());
        if (dateRange?.to) params.append("end", dateRange.to.toISOString());

        const response = await fetch(`/api/user/export?${params}`);
        if (!response.ok) throw new Error("Server error — please try again.");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr =
            dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`
                : "all_time";
        a.download = `fithub_export_${dateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = async () => {
        const body: Record<string, string> = { unitPreference: preference };
        if (dateRange?.from) body.start = dateRange.from.toISOString();
        if (dateRange?.to) body.end = dateRange.to.toISOString();

        const response = await fetch("/api/export/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (response.status === 404) {
            const data = await response.json();
            throw new Error(data.error || "No completed workouts found in this date range.");
        }
        if (!response.ok) throw new Error("Server error — please try again.");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr =
            dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`
                : "all_time";
        a.download = `fithub_progress_${dateStr}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExport = async (formatType: "csv" | "pdf") => {
        setLoading(formatType);
        setStatus(null);
        try {
            if (formatType === "csv") {
                await handleExportCsv();
                setStatus({ type: "success", text: "Spreadsheet downloaded — check your Downloads folder." });
            } else {
                await handleExportPdf();
                setStatus({ type: "success", text: "Progress report downloaded — check your Downloads folder." });
            }
        } catch (err: any) {
            setStatus({ type: "error", text: err.message || "Something went wrong. Please try again." });
        } finally {
            setLoading(null);
        }
    };

    return (
        <Card className="border-border/60">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Download className="h-4 w-4 text-primary" />
                    Export Your Data
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                    Download a copy of your workout history. Choose the format that works best for you.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Date range filter */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Date Range
                        </span>
                    </div>
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                    {dateRange?.from && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Exporting:{" "}
                                <span className="font-medium text-foreground">{rangeLabel}</span>
                            </p>
                            <button
                                onClick={() => setDateRange(undefined)}
                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Format options */}
                <div className="space-y-2.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Choose Format
                    </span>
                    <div className="space-y-2">
                        {FORMAT_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isLoading = loading === opt.id;
                            const isDisabled = loading !== null;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleExport(opt.id)}
                                    disabled={isDisabled}
                                    className={cn(
                                        "w-full flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/40 p-4 text-left transition-all duration-150",
                                        "hover:border-primary/30 hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-primary/20",
                                        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                            opt.id === "csv" ? "bg-blue-500/10" : "bg-emerald-500/10"
                                        )}
                                    >
                                        {isLoading ? (
                                            <Loader2
                                                className={cn(
                                                    "h-4 w-4 animate-spin",
                                                    opt.id === "csv" ? "text-blue-500" : "text-emerald-500"
                                                )}
                                            />
                                        ) : (
                                            <Icon
                                                className={cn(
                                                    "h-4 w-4",
                                                    opt.id === "csv" ? "text-blue-500" : "text-emerald-500"
                                                )}
                                            />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-semibold text-foreground">
                                                {isLoading
                                                    ? opt.id === "csv"
                                                        ? "Preparing spreadsheet…"
                                                        : "Building report…"
                                                    : opt.label}
                                            </span>
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                                    opt.badgeColor
                                                )}
                                            >
                                                {opt.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {opt.description}
                                        </p>
                                    </div>

                                    {!isLoading && (
                                        <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Status message */}
                {status && (
                    <div
                        className={cn(
                            "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
                            status.type === "success"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                        )}
                    >
                        {status.type === "success" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <span className="leading-relaxed">{status.text}</span>
                    </div>
                )}

                <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                    Your data is yours. Exports include only your own workouts and are never shared.
                </p>
            </CardContent>
        </Card>
    );
}
