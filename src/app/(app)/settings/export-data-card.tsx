"use client";

import { useState } from "react";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { DateRange } from "react-day-picker";
import { KG_TO_LBS } from "@/lib/units";
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
import { generateProgressPDF, type PDFReportData } from "@/lib/pdf-export";
import { createClient } from "@/lib/supabase/client";
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
    const { preference, unitLabel } = useUnitPreferenceStore();

    const volumeFactor = preference === "imperial" ? KG_TO_LBS : 1;
    const toDisplayWeight = (kg: number) => Math.round(kg * volumeFactor * 10) / 10;
    const toDisplayVolumeValue = (kgVolume: number) => kgVolume * volumeFactor;

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
        const supabase = createClient();

        // ── 1. Get authenticated user ─────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in.");

        // ── 2. Fetch completed sessions ───────────────────────────────────────
        let sessionsQuery = supabase
            .from("workout_sessions")
            .select("id, name, started_at, completed_at, duration_seconds, total_volume_kg")
            .eq("user_id", user.id)
            .eq("status", "completed")
            .order("started_at", { ascending: false });

        if (dateRange?.from) sessionsQuery = sessionsQuery.gte("started_at", dateRange.from.toISOString());
        if (dateRange?.to) sessionsQuery = sessionsQuery.lte("started_at", dateRange.to.toISOString());

        const { data: sessions, error: sessErr } = await sessionsQuery;
        if (sessErr) throw new Error("Failed to load sessions.");
        if (!sessions?.length) throw new Error("No completed workouts found in this date range.");

        // ── 3. Fetch sets with exercise names for all sessions ─────────────────
        const sessionIds = sessions.map((s) => s.id);
        const { data: sets, error: setsErr } = await supabase
            .from("workout_sets")
            .select("session_id, reps, weight_kg, set_type, exercises(name, muscle_group)")
            .in("session_id", sessionIds)
            .order("sort_order", { ascending: true });

        if (setsErr) throw new Error("Failed to load set data.");

        // ── 4. Group sets by session, build exercise summaries ─────────────────
        type ExSummary = { name: string; group: string; sets: { w: number; r: number }[] };
        const setsBySession = new Map<string, Map<string, ExSummary>>();

        for (const set of sets ?? []) {
            const exName = (set.exercises as any)?.name ?? "Unknown Exercise";
            const exGroup = (set.exercises as any)?.muscle_group ?? "";
            if (!setsBySession.has(set.session_id)) setsBySession.set(set.session_id, new Map());
            const exMap = setsBySession.get(set.session_id)!;
            if (!exMap.has(exName)) exMap.set(exName, { name: exName, group: exGroup, sets: [] });
            if (set.weight_kg != null) {
                exMap.get(exName)!.sets.push({ w: set.weight_kg, r: set.reps ?? 0 });
            }
        }

        // ── 5. Build strength chart sparklines from all set data ───────────────
        const prMap = new Map<string, {
            name: string; group: string;
            sessionData: Map<string, number>; // session_id → best score
        }>();

        for (const set of sets ?? []) {
            const exName = (set.exercises as any)?.name;
            if (!exName || set.weight_kg == null) continue;
            const score = (set.weight_kg * volumeFactor) * (set.reps ?? 1);
            if (!prMap.has(exName)) {
                prMap.set(exName, {
                    name: exName,
                    group: (set.exercises as any)?.muscle_group ?? "",
                    sessionData: new Map(),
                });
            }
            const ex = prMap.get(exName)!;
            const cur = ex.sessionData.get(set.session_id) ?? 0;
            if (score > cur) ex.sessionData.set(set.session_id, score);
        }

        // Build sparklines (session index as x-axis)
        const strengthCharts: PDFReportData["strengthCharts"] = [...prMap.values()]
            .map((ex) => {
                // Order by session date using the sessions array
                const ordered = sessions
                    .filter((s) => ex.sessionData.has(s.id))
                    .map((s) => ({ date: format(new Date(s.started_at), "MMM d"), value: Math.round(ex.sessionData.get(s.id)!) }));
                const first = ordered[0]?.value ?? 0;
                const last = ordered[ordered.length - 1]?.value ?? 0;
                const trend = first > 0 ? ((last - first) / first) * 100 : 0;
                return { name: ex.name, muscleGroup: ex.group, dataPoints: ordered, trend, unitLabel };
            })
            .filter((c) => c.dataPoints.length >= 2)
            .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
            .slice(0, 6);

        // ── 6. Build personal records ──────────────────────────────────────────
        const personalRecords: PDFReportData["personalRecords"] = [...prMap.values()]
            .map((ex) => {
                let bestScore = 0;
                let bestW = 0, bestR = 0;
                let bestDate = "";
                for (const set of sets ?? []) {
                    if ((set.exercises as any)?.name !== ex.name || set.weight_kg == null) continue;
                    const score = (set.weight_kg * volumeFactor) * (set.reps ?? 1);
                    if (score > bestScore) {
                        bestScore = score;
                        bestW = toDisplayWeight(set.weight_kg);
                        bestR = set.reps ?? 0;
                        // find session date
                        const sess = sessions.find((s) => s.id === set.session_id);
                        bestDate = sess ? format(new Date(sess.started_at), "MMM d, yyyy") : "";
                    }
                }
                return { name: ex.name, muscleGroup: ex.group, bestWeight: bestW, bestReps: bestR, date: bestDate };
            })
            .filter((pr) => pr.bestWeight > 0)
            .sort((a, b) => b.bestWeight * b.bestReps - a.bestWeight * a.bestReps)
            .slice(0, 15);

        // ── 7. Build session summaries for the PDF ─────────────────────────────
        const sessionSummaries = sessions.slice(0, 20).map((s) => {
            const exMap = setsBySession.get(s.id);
            const exercises = exMap
                ? [...exMap.values()].map((ex) => {
                    const maxW = Math.max(...ex.sets.map((st) => st.w));
                    return `${ex.name}: ${ex.sets.length} set${ex.sets.length !== 1 ? "s" : ""} · up to ${toDisplayWeight(maxW)} ${unitLabel}`;
                })
                : [];

            let durationStr = "";
            if (s.duration_seconds) {
                const dur = intervalToDuration({ start: 0, end: s.duration_seconds * 1000 });
                durationStr = formatDuration(dur, { format: ["hours", "minutes"] }) || `${s.duration_seconds}s`;
            }

            return {
                name: s.name || "Unnamed Workout",
                date: format(new Date(s.started_at), "EEEE, MMM d, yyyy"),
                time: format(new Date(s.started_at), "h:mm a"),
                duration: durationStr,
                volume: s.total_volume_kg
                    ? `${Math.round(toDisplayVolumeValue(s.total_volume_kg)).toLocaleString()} ${unitLabel} total`
                    : null,
                exercises,
            };
        });

        await generateProgressPDF({
            userName: user.email?.split("@")[0] ?? "Athlete",
            reportDate: new Date(),
            totalSessions: sessions.length,
            totalPRs: personalRecords.length,
            avgVolume: toDisplayVolumeValue(
                sessions.reduce((s, r) => s + (r.total_volume_kg ?? 0), 0) / sessions.length
            ),
            strengthCharts,
            personalRecords,
            sessionSummaries,
        });
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
