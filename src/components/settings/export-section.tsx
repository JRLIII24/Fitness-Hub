"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, FileText, Table } from "lucide-react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export function ExportSection() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    const handleExport = async (formatType: "csv" | "pdf") => {
        if (formatType === "pdf") {
            toast.info("PDF export is currently in development.", {
                description: "Please use CSV export for now."
            });
            return;
        }

        try {
            setIsExportingCSV(true);

            const params = new URLSearchParams({ format: "csv" });

            if (dateRange?.from) {
                params.append("start", dateRange.from.toISOString());
            }
            if (dateRange?.to) {
                params.append("end", dateRange.to.toISOString());
            }

            const response = await fetch(`/api/user/export?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Export failed");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            let dateString = "all_time";
            if (dateRange?.from && dateRange?.to) {
                dateString = `${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`;
            } else if (dateRange?.from) {
                dateString = `from_${format(dateRange.from, "yyyy-MM-dd")}`;
            }

            a.download = `fit_hub_export_${dateString}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success("Successfully exported workout data");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export your data. Please try again.");
        } finally {
            setIsExportingCSV(false);
        }
    };

    return (
        <Card className="border-border/60">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Download className="h-4 w-4 text-primary" />
                    Export Data
                </CardTitle>
                <CardDescription className="text-xs">
                    Download your workout history. Select a date range to filter your export.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Timeframe</label>
                    <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        disabled={isExportingCSV}
                        onClick={() => handleExport("csv")}
                    >
                        <Table className="h-4 w-4" />
                        {isExportingCSV ? "Exporting..." : "Export CSV"}
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        disabled={isExportingPDF}
                        onClick={() => handleExport("pdf")}
                    >
                        <FileText className="h-4 w-4" />
                        Export PDF
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
