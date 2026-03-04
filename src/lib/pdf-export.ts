import jsPDF from "jspdf";
import { format } from "date-fns";

export interface PDFReportData {
    userName: string;
    reportDate: Date;
    totalSessions: number;
    totalPRs: number;
    avgVolume?: number;
    strengthCharts: {
        name: string;
        muscleGroup: string;
        dataPoints: { date: string; value: number }[];
        trend: number;
        unitLabel: string;
    }[];
    personalRecords: {
        name: string;
        muscleGroup: string;
        bestWeight: number;
        bestReps: number;
        date: string;
    }[];
    /** Optional: session-by-session summaries for the workout log section */
    sessionSummaries?: {
        name: string;
        date: string;
        time: string;
        duration: string;
        volume: string | null;
        exercises: string[];
    }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function setFill(doc: jsPDF, hex: string) {
    doc.setFillColor(...hexToRgb(hex));
}

function setDraw(doc: jsPDF, hex: string) {
    doc.setDrawColor(...hexToRgb(hex));
}

function setTextColor(doc: jsPDF, hex: string) {
    doc.setTextColor(...hexToRgb(hex));
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Builds a PDF report entirely programmatically with jsPDF — no html2canvas,
 * no DOM capture, no CSS color parsing. This sidesteps all oklch/lab issues.
 */
export async function generateProgressPDF(data: PDFReportData, options?: { returnBuffer: true }): Promise<ArrayBuffer>;
export async function generateProgressPDF(data: PDFReportData, options?: { returnBuffer?: false }): Promise<void>;
export async function generateProgressPDF(data: PDFReportData, options?: { returnBuffer?: boolean }): Promise<void | ArrayBuffer> {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();   // 210mm
    const margin = 16;
    const contentW = W - margin * 2;
    let y = margin;

    // ── Page helpers ─────────────────────────────────────────────────────────

    function checkPageBreak(needed: number) {
        const H = doc.internal.pageSize.getHeight();
        if (y + needed > H - margin) {
            doc.addPage();
            y = margin;
        }
    }

    function sectionTitle(text: string) {
        checkPageBreak(14);
        setTextColor(doc, "#111827");
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(text, margin, y);
        y += 2;
        setDraw(doc, "#e5e7eb");
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentW, y);
        y += 5;
    }

    function labelValue(label: string, value: string, x: number, boxW: number) {
        setFill(doc, "#f9fafb");
        setDraw(doc, "#e5e7eb");
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, boxW, 18, 3, 3, "FD");

        setTextColor(doc, "#6b7280");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(label, x + 4, y + 5.5);

        setTextColor(doc, "#111827");
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(value, x + 4, y + 13.5);
    }

    // ── Header ────────────────────────────────────────────────────────────────

    // Title bar background
    setFill(doc, "#111827");
    doc.rect(0, 0, W, 22, "F");

    setTextColor(doc, "#ffffff");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Fit-Hub Progress Report", margin, 14);

    setTextColor(doc, "#9ca3af");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
        `${data.userName}  ·  Generated ${format(data.reportDate, "MMMM d, yyyy")}`,
        margin,
        19,
    );

    y = 32;

    // ── Summary stats ─────────────────────────────────────────────────────────

    sectionTitle("Summary Overview");

    const statCount = data.avgVolume !== undefined ? 3 : 2;
    const statW = (contentW - (statCount - 1) * 4) / statCount;

    labelValue("Total Sessions", String(data.totalSessions), margin, statW);
    labelValue("Personal Records", String(data.totalPRs), margin + statW + 4, statW);
    if (data.avgVolume !== undefined) {
        labelValue(
            "Avg Vol / Session",
            `${(data.avgVolume / 1000).toFixed(1)}k`,
            margin + (statW + 4) * 2,
            statW,
        );
    }
    y += 22;

    // ── Session log ───────────────────────────────────────────────────────────

    if (data.sessionSummaries?.length) {
        checkPageBreak(20);
        sectionTitle("Recent Workout Log");

        for (const session of data.sessionSummaries) {
            const exLines = session.exercises.slice(0, 6);
            const cardH = 8 + exLines.length * 5 + 6;
            checkPageBreak(cardH + 3);

            // Card background
            setFill(doc, "#f9fafb");
            setDraw(doc, "#e5e7eb");
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, y, contentW, cardH, 3, 3, "FD");

            // Left accent bar
            setFill(doc, "#111827");
            doc.rect(margin, y, 2.5, cardH, "F");

            // Workout name
            setTextColor(doc, "#111827");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            const name = session.name.length > 55 ? session.name.slice(0, 53) + "…" : session.name;
            doc.text(name, margin + 7, y + 6);

            // Date · Time · Duration · Volume — right-aligned meta
            const meta = [session.date, session.time, session.duration, session.volume]
                .filter(Boolean)
                .join("  ·  ");
            setTextColor(doc, "#6b7280");
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.text(meta, margin + contentW - 3, y + 6, { align: "right" });

            // Exercise bullets
            let ey = y + 11;
            for (const ex of exLines) {
                setTextColor(doc, "#374151");
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                // Bullet dot
                setFill(doc, "#9ca3af");
                doc.circle(margin + 9.5, ey - 1.5, 0.8, "F");
                doc.text(ex, margin + 12, ey);
                ey += 5;
            }
            if (session.exercises.length > 6) {
                setTextColor(doc, "#9ca3af");
                doc.setFontSize(6.5);
                doc.text(`+ ${session.exercises.length - 6} more exercise${session.exercises.length - 6 !== 1 ? "s" : ""}`, margin + 12, ey);
            }

            y += cardH + 3;
        }
        y += 4;
    }

    // ── Strength trends ───────────────────────────────────────────────────────

    if (data.strengthCharts.length > 0) {
        sectionTitle("Top Strength Trends");


        const charts = data.strengthCharts.slice(0, 6);
        const colW = (contentW - 4) / 2;
        const rowH = 36;

        for (let i = 0; i < charts.length; i++) {
            const col = i % 2;
            const x = margin + col * (colW + 4);
            if (col === 0) checkPageBreak(rowH + 2);

            const chart = charts[i];
            const trendPositive = chart.trend > 0;
            const trendNeutral = chart.trend === 0;

            // Card background
            setFill(doc, "#ffffff");
            setDraw(doc, "#e5e7eb");
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, colW, rowH, 3, 3, "FD");

            // Exercise name
            setTextColor(doc, "#111827");
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            const name = chart.name.length > 28 ? chart.name.slice(0, 26) + "…" : chart.name;
            doc.text(name, x + 3, y + 6);

            // Muscle group
            setTextColor(doc, "#6b7280");
            doc.setFontSize(6);
            doc.setFont("helvetica", "normal");
            doc.text(chart.muscleGroup.replace("_", " ").toUpperCase(), x + 3, y + 10.5);

            // Trend badge
            const trendBg = trendPositive ? "#d1fae5" : trendNeutral ? "#f3f4f6" : "#fee2e2";
            const trendFg = trendPositive ? "#047857" : trendNeutral ? "#4b5563" : "#b91c1c";
            const trendText = `${trendPositive ? "+" : ""}${Math.round(chart.trend)}%`;
            const badgeW = doc.getTextWidth(trendText) + 4;
            setFill(doc, trendBg);
            doc.roundedRect(x + colW - badgeW - 3, y + 3, badgeW, 5, 1, 1, "F");
            setTextColor(doc, trendFg);
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.text(trendText, x + colW - badgeW - 1, y + 7);

            // Mini sparkline
            const pts = chart.dataPoints;
            if (pts.length >= 2) {
                const graphX = x + 3;
                const graphY = y + 14;
                const graphW = colW - 6;
                const graphH = 16;
                const minV = Math.min(...pts.map((p) => p.value));
                const maxV = Math.max(...pts.map((p) => p.value));
                const range = maxV - minV || 1;

                const toX = (i: number) => graphX + (i / (pts.length - 1)) * graphW;
                const toY = (v: number) => graphY + graphH - ((v - minV) / range) * graphH;

                // Fill area
                setFill(doc, "#eff6ff");
                doc.setLineWidth(0);
                const pathPts: [number, number][] = [
                    [graphX, graphY + graphH],
                    ...pts.map((p, i) => [toX(i), toY(p.value)] as [number, number]),
                    [toX(pts.length - 1), graphY + graphH],
                ];
                // Approximate fill with a polygon
                const polyX = pathPts.map((p) => p[0]);
                const polyY = pathPts.map((p) => p[1]);
                // jsPDF doesn't have polygon fill natively — draw lines approach
                doc.setLineWidth(0);
                setFill(doc, "#dbeafe");
                // Draw the sparkline itself
                setDraw(doc, "#3b82f6");
                doc.setLineWidth(0.5);
                for (let j = 1; j < pts.length; j++) {
                    doc.line(toX(j - 1), toY(pts[j - 1].value), toX(j), toY(pts[j].value));
                }

                // Start/end value labels
                setTextColor(doc, "#6b7280");
                doc.setFontSize(5.5);
                doc.setFont("helvetica", "normal");
                doc.text(`${Math.round(pts[0].value)}`, graphX, graphY + graphH + 4);
                const lastVal = `${Math.round(pts[pts.length - 1].value)} ${chart.unitLabel}`;
                doc.text(lastVal, toX(pts.length - 1) - doc.getTextWidth(lastVal), graphY + graphH + 4);
            } else {
                setTextColor(doc, "#9ca3af");
                doc.setFontSize(6);
                doc.text("Not enough data", x + 3, y + 22);
            }

            if (col === 1) y += rowH + 3;
        }
        // If odd number of charts, advance y
        if (charts.length % 2 !== 0) y += rowH + 3;
        y += 4;
    }

    // ── Personal records table ────────────────────────────────────────────────

    if (data.personalRecords.length > 0) {
        checkPageBreak(20);
        sectionTitle("All-Time Personal Records");

        const prs = data.personalRecords.slice(0, 15);
        const cols = [
            { label: "Exercise", w: contentW * 0.40 },
            { label: "Muscle Group", w: contentW * 0.22 },
            { label: "Best Weight", w: contentW * 0.20 },
            { label: "Date", w: contentW * 0.18 },
        ];
        const rowH = 7;

        // Header row
        checkPageBreak(rowH + 1);
        setFill(doc, "#f9fafb");
        setDraw(doc, "#e5e7eb");
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentW, rowH, "FD");

        let cx = margin;
        for (const col of cols) {
            setTextColor(doc, "#6b7280");
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.text(col.label.toUpperCase(), cx + 2, y + 4.5);
            cx += col.w;
        }
        y += rowH;

        // Data rows
        for (let i = 0; i < prs.length; i++) {
            const pr = prs[i];
            checkPageBreak(rowH);
            setFill(doc, i % 2 === 0 ? "#ffffff" : "#f9fafb");
            setDraw(doc, "#e5e7eb");
            doc.setLineWidth(0.2);
            doc.rect(margin, y, contentW, rowH, "FD");

            const values = [
                pr.name.length > 30 ? pr.name.slice(0, 28) + "…" : pr.name,
                pr.muscleGroup.replace("_", " "),
                `${pr.bestWeight} × ${pr.bestReps}`,
                pr.date,
            ];
            let cx = margin;
            setTextColor(doc, "#111827");
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            for (let j = 0; j < values.length; j++) {
                if (j === 2) doc.setFont("helvetica", "bold");
                doc.text(values[j], cx + 2, y + 4.5);
                doc.setFont("helvetica", "normal");
                cx += cols[j].w;
            }
            y += rowH;
        }
        y += 6;
    }

    // ── Footer ────────────────────────────────────────────────────────────────

    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        const H = doc.internal.pageSize.getHeight();
        setDraw(doc, "#e5e7eb");
        doc.setLineWidth(0.3);
        doc.line(margin, H - 10, margin + contentW, H - 10);
        setTextColor(doc, "#9ca3af");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text("Powered by Fit-Hub • Your personal fitness companion", margin, H - 6);
        doc.text(`Page ${p} of ${pageCount}`, W - margin, H - 6, { align: "right" });
    }

    // ── Save or return buffer ──────────────────────────────────────────────────

    if (options?.returnBuffer) {
        return doc.output("arraybuffer");
    }

    const dateStr = format(data.reportDate, "yyyy-MM-dd");
    doc.save(`FitHub_Progress_${dateStr}.pdf`);
}
