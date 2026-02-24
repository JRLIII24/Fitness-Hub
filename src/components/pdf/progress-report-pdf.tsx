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
            className="bg-white text-black p-10 font-sans"
            style={{
                width: "794px", // A4 width
                minHeight: "1123px", // A4 height
                position: "absolute",
                left: "-9999px", // Hide from view
                top: "-9999px",
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-200 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                        Fit-Hub Progress Report
                    </h1>
                    <p className="text-gray-500 mt-1 text-lg">{userName}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider">
                        Report Generated
                    </p>
                    <p className="text-gray-900 font-medium">
                        {format(reportDate, "MMMM d, yyyy")}
                    </p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="mb-10">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-100 pb-2">
                    Summary Overview
                </h2>
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Sessions</p>
                        <p className="text-3xl font-bold text-gray-900">{summaryStats.totalSessions}</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Personal Records</p>
                        <p className="text-3xl font-bold text-emerald-600">{summaryStats.totalPRs}</p>
                    </div>
                    {summaryStats.avgVolume !== undefined && (
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-500 mb-1">Avg Vol per Session</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {(summaryStats.avgVolume / 1000).toFixed(1)}k
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Strength Trends */}
            {strengthCharts.length > 0 && (
                <div className="mb-12" style={{ pageBreakInside: "avoid" }}>
                    <h2 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-100 pb-2">
                        Top Strength Trends
                    </h2>
                    <div className="grid grid-cols-2 gap-6">
                        {strengthCharts.slice(0, 6).map((chart, i) => (
                            <div
                                key={i}
                                className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{chart.name}</h3>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">
                                            {chart.muscleGroup.replace("_", " ")}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs font-bold px-2 py-1 rounded-full ${chart.trend > 0
                                                ? "bg-emerald-100 text-emerald-700"
                                                : chart.trend < 0
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-600"
                                            }`}
                                    >
                                        {chart.trend > 0 ? "+" : ""}
                                        {Math.round(chart.trend)}%
                                    </span>
                                </div>
                                <div className="h-32 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={chart.dataPoints}
                                            margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                                        >
                                            <XAxis
                                                dataKey="date"
                                                hide
                                            />
                                            <YAxis
                                                domain={['dataMin', 'dataMax']}
                                                hide
                                            />
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
                                                isAnimationActive={false} // CRITICAL for PDF export
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
                    <h2 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-100 pb-2">
                        All-Time Personal Records
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Exercise
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Muscle Group
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Best Weight
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date Achieved
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {personalRecords.slice(0, 15).map((pr, i) => (
                                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {pr.name}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 capitalize">
                                            {pr.muscleGroup.replace("_", " ")}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                            {pr.bestWeight} <span className="text-gray-500 font-normal">x {pr.bestReps}</span>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
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
            <div className="absolute bottom-10 left-10 right-10 text-center text-xs text-gray-400 border-t border-gray-100 pt-4">
                Powered by Fit-Hub • Your personal fitness companion
            </div>
        </div>
    );
}
