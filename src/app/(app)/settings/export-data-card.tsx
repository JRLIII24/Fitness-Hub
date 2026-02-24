"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function ExportDataCard() {
    const [isExportingCsv, setIsExportingCsv] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleExportCsv = async () => {
        setIsExportingCsv(true);
        setStatusMessage(null);
        try {
            const response = await fetch("/api/user/export?format=csv");
            if (!response.ok) throw new Error("Failed to generate CSV");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `workout_history_${format(new Date(), "yyyy-MM-dd")}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setStatusMessage({ type: "success", text: "CSV exported successfully!" });
        } catch (error: any) {
            setStatusMessage({ type: "error", text: error.message || "Failed to export CSV" });
        } finally {
            setIsExportingCsv(false);
        }
    };

    const handleExportPdf = async () => {
        setIsExportingPdf(true);
        setStatusMessage(null);
        try {
            const response = await fetch("/api/user/export?format=json");
            if (!response.ok) throw new Error("Failed to fetch data");

            const text = await response.text();
            if (!text.trim()) throw new Error("No data found");

            const data = JSON.parse(text);
            if (!data.length) throw new Error("No data found to export");

            const doc = new jsPDF({ orientation: "portrait" });

            const title = "Workout History Export";
            doc.setFontSize(18);
            doc.text(title, 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on ${format(new Date(), "MMMM d, yyyy")}`, 14, 30);

            // We select the most relevant columns to keep the PDF readable
            const headers = ["Date", "Session", "Exercise", "Set", "Weight", "Reps"];
            const rows = data.map((item: any) => {
                return [
                    item.session_started_at ? format(new Date(item.session_started_at), "yyyy-MM-dd") : "",
                    item.session_name || "Unnamed",
                    item.exercise_id ? item.exercise_id.substring(0, 15) + "..." : "Rest/Other",
                    item.set_number !== null ? String(item.set_number) : "-",
                    item.weight_kg !== null ? `${item.weight_kg} kg` : "-",
                    item.reps !== null ? String(item.reps) : "-",
                ];
            });

            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 38,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [15, 23, 42] }, // Slate 900
                alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate 50
                theme: 'striped'
            });

            doc.save(`workout_history_${format(new Date(), "yyyy-MM-dd")}.pdf`);
            setStatusMessage({ type: "success", text: "PDF exported successfully!" });
        } catch (error: any) {
            setStatusMessage({ type: "error", text: error.message || "Failed to export PDF" });
        } finally {
            setIsExportingPdf(false);
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
                    Download your complete workout history in CSV or PDF format
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleExportCsv}
                        disabled={isExportingCsv || isExportingPdf}
                    >
                        {isExportingCsv ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="h-4 w-4" />
                        )}
                        {isExportingCsv ? "Exporting CSV..." : "Export as CSV"}
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleExportPdf}
                        disabled={isExportingCsv || isExportingPdf}
                    >
                        {isExportingPdf ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="h-4 w-4" />
                        )}
                        {isExportingPdf ? "Exporting PDF..." : "Export as PDF"}
                    </Button>
                </div>

                {statusMessage && (
                    <div
                        className={`flex items-center gap-2 text-sm p-3 rounded-md ${statusMessage.type === "success"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                : "bg-red-50 text-red-600 border border-red-200"
                            }`}
                    >
                        {statusMessage.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                            <AlertCircle className="h-4 w-4 shrink-0" />
                        )}
                        {statusMessage.text}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
