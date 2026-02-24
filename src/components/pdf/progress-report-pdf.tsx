"use client";

import React from "react";
import { format } from "date-fns";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

interface ProgressReportPdfProps {
    id?: string;
    userName: string;
    reportDate: Date;
    summaryStats: {
        totalSessions: number;
        totalPRs: number;
        avgVolume?: number;
    };
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
}

/**
 * PDF report template.
 *
 * ALL colours are expressed as inline hex/rgb values so that html2canvas
 * can parse every computed style. Tailwind v4 resolves utilities such as
 * `text-gray-900` to oklch() / lab() internally, and html2canvas 1.x
 * cannot parse those colour functions — resulting in the
 * "Attempting to parse an unsupported color function 'lab'" console error
 * and a blank or broken PDF.
 */
export function ProgressReportPdf({
    id = "pdf-report-container",
    userName,
    reportDate,
    summaryStats,
    strengthCharts,
    personalRecords,
}: ProgressReportPdfProps) {
    return (
        <div
            id={id}
            style={{
                width: "794px",
                minHeight: "1123px",
                position: "absolute",
                left: "-9999px",
                top: "-9999px",
                backgroundColor: "#ffffff",
                color: "#111827",
                padding: "40px",
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: "24px",
                    marginBottom: "32px",
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: "30px",
                            fontWeight: 800,
                            letterSpacing: "-0.025em",
                            color: "#111827",
                            margin: 0,
                        }}
                    >
                        Fit-Hub Progress Report
                    </h1>
                    <p style={{ color: "#6b7280", marginTop: "4px", fontSize: "18px" }}>
                        {userName}
                    </p>
                </div>
                <div style={{ textAlign: "right" }}>
                    <p
                        style={{
                            fontSize: "12px",
                            color: "#9ca3af",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        Report Generated
                    </p>
                    <p style={{ color: "#111827", fontWeight: 500 }}>
                        {format(reportDate, "MMMM d, yyyy")}
                    </p>
                </div>
            </div>

            {/* Summary Stats */}
            <div style={{ marginBottom: "40px" }}>
                <h2
                    style={{
                        fontSize: "20px",
                        fontWeight: 700,
                        marginBottom: "16px",
                        color: "#1f2937",
                        borderBottom: "1px solid #f3f4f6",
                        paddingBottom: "8px",
                    }}
                >
                    Summary Overview
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                    <div
                        style={{
                            backgroundColor: "#f9fafb",
                            padding: "20px",
                            borderRadius: "16px",
                            border: "1px solid #f3f4f6",
                        }}
                    >
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", marginBottom: "4px" }}>
                            Total Sessions
                        </p>
                        <p style={{ fontSize: "30px", fontWeight: 700, color: "#111827", margin: 0 }}>
                            {summaryStats.totalSessions}
                        </p>
                    </div>
                    <div
                        style={{
                            backgroundColor: "#f9fafb",
                            padding: "20px",
                            borderRadius: "16px",
                            border: "1px solid #f3f4f6",
                        }}
                    >
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", marginBottom: "4px" }}>
                            Personal Records
                        </p>
                        <p style={{ fontSize: "30px", fontWeight: 700, color: "#059669", margin: 0 }}>
                            {summaryStats.totalPRs}
                        </p>
                    </div>
                    {summaryStats.avgVolume !== undefined && (
                        <div
                            style={{
                                backgroundColor: "#f9fafb",
                                padding: "20px",
                                borderRadius: "16px",
                                border: "1px solid #f3f4f6",
                            }}
                        >
                            <p style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", marginBottom: "4px" }}>
                                Avg Vol per Session
                            </p>
                            <p style={{ fontSize: "30px", fontWeight: 700, color: "#111827", margin: 0 }}>
                                {(summaryStats.avgVolume / 1000).toFixed(1)}k
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Strength Trends */}
            {strengthCharts.length > 0 && (
                <div style={{ marginBottom: "48px", pageBreakInside: "avoid" }}>
                    <h2
                        style={{
                            fontSize: "20px",
                            fontWeight: 700,
                            marginBottom: "16px",
                            color: "#1f2937",
                            borderBottom: "1px solid #f3f4f6",
                            paddingBottom: "8px",
                        }}
                    >
                        Top Strength Trends
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                        {strengthCharts.slice(0, 6).map((chart, i) => (
                            <div
                                key={i}
                                style={{
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "16px",
                                    padding: "16px",
                                    backgroundColor: "#ffffff",
                                    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        marginBottom: "12px",
                                    }}
                                >
                                    <div>
                                        <h3 style={{ fontWeight: 700, color: "#111827", margin: 0 }}>
                                            {chart.name}
                                        </h3>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                marginTop: "2px",
                                            }}
                                        >
                                            {chart.muscleGroup.replace("_", " ")}
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            padding: "4px 8px",
                                            borderRadius: "9999px",
                                            backgroundColor:
                                                chart.trend > 0
                                                    ? "#d1fae5"
                                                    : chart.trend < 0
                                                        ? "#fee2e2"
                                                        : "#f3f4f6",
                                            color:
                                                chart.trend > 0
                                                    ? "#047857"
                                                    : chart.trend < 0
                                                        ? "#b91c1c"
                                                        : "#4b5563",
                                        }}
                                    >
                                        {chart.trend > 0 ? "+" : ""}
                                        {Math.round(chart.trend)}%
                                    </span>
                                </div>
                                <div style={{ height: "128px", width: "100%" }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={chart.dataPoints}
                                            margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                                        >
                                            <XAxis dataKey="date" hide />
                                            <YAxis domain={["dataMin", "dataMax"]} hide />
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                                stroke="#f3f4f6"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#0f172a"
                                                strokeWidth={2}
                                                fill="#f1f5f9"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Personal Records */}
            {personalRecords.length > 0 && (
                <div style={{ pageBreakInside: "avoid" }}>
                    <h2
                        style={{
                            fontSize: "20px",
                            fontWeight: 700,
                            marginBottom: "16px",
                            color: "#1f2937",
                            borderBottom: "1px solid #f3f4f6",
                            paddingBottom: "8px",
                        }}
                    >
                        All-Time Personal Records
                    </h2>
                    <div
                        style={{
                            overflow: "hidden",
                            borderRadius: "12px",
                            border: "1px solid #e5e7eb",
                        }}
                    >
                        <table
                            style={{
                                minWidth: "100%",
                                borderCollapse: "collapse",
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: "#f9fafb" }}>
                                    <th
                                        style={{
                                            padding: "12px 24px",
                                            textAlign: "left",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            color: "#6b7280",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid #e5e7eb",
                                        }}
                                    >
                                        Exercise
                                    </th>
                                    <th
                                        style={{
                                            padding: "12px 24px",
                                            textAlign: "left",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            color: "#6b7280",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid #e5e7eb",
                                        }}
                                    >
                                        Muscle Group
                                    </th>
                                    <th
                                        style={{
                                            padding: "12px 24px",
                                            textAlign: "right",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            color: "#6b7280",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid #e5e7eb",
                                        }}
                                    >
                                        Best Weight
                                    </th>
                                    <th
                                        style={{
                                            padding: "12px 24px",
                                            textAlign: "right",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            color: "#6b7280",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid #e5e7eb",
                                        }}
                                    >
                                        Date Achieved
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {personalRecords.slice(0, 15).map((pr, i) => (
                                    <tr
                                        key={i}
                                        style={{
                                            backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                                            borderBottom: "1px solid #e5e7eb",
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: "12px 24px",
                                                whiteSpace: "nowrap",
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                color: "#111827",
                                            }}
                                        >
                                            {pr.name}
                                        </td>
                                        <td
                                            style={{
                                                padding: "12px 24px",
                                                whiteSpace: "nowrap",
                                                fontSize: "14px",
                                                color: "#6b7280",
                                                textTransform: "capitalize",
                                            }}
                                        >
                                            {pr.muscleGroup.replace("_", " ")}
                                        </td>
                                        <td
                                            style={{
                                                padding: "12px 24px",
                                                whiteSpace: "nowrap",
                                                fontSize: "14px",
                                                fontWeight: 700,
                                                color: "#111827",
                                                textAlign: "right",
                                            }}
                                        >
                                            {pr.bestWeight}{" "}
                                            <span style={{ color: "#6b7280", fontWeight: 400 }}>
                                                x {pr.bestReps}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: "12px 24px",
                                                whiteSpace: "nowrap",
                                                fontSize: "14px",
                                                color: "#6b7280",
                                                textAlign: "right",
                                            }}
                                        >
                                            {pr.date}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div
                style={{
                    position: "absolute",
                    bottom: "40px",
                    left: "40px",
                    right: "40px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#9ca3af",
                    borderTop: "1px solid #f3f4f6",
                    paddingTop: "16px",
                }}
            >
                Powered by Fit-Hub • Your personal fitness companion
            </div>
        </div>
    );
}
