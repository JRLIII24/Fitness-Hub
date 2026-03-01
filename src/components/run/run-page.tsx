"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  Heart,
  Lock,
  Mic,
  Mountain,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Shield,
  Square,
  Target,
  Timer,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type RScreen = "hub" | "prerun" | "active" | "pause" | "summary" | "detail";

const ZONES: Record<number, { label: string; name: string; color: string; bg: string; range: string }> = {
  1: { label: "Z1", name: "Recovery", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", range: "< 120 bpm" },
  2: { label: "Z2", name: "Aerobic", color: "#4ade80", bg: "rgba(74,222,128,0.1)", range: "120–140" },
  3: { label: "Z3", name: "Tempo", color: "#facc15", bg: "rgba(250,204,21,0.1)", range: "140–160" },
  4: { label: "Z4", name: "Threshold", color: "#f97316", bg: "rgba(249,115,22,0.1)", range: "160–175" },
  5: { label: "Z5", name: "Max", color: "#ef4444", bg: "rgba(239,68,68,0.1)", range: "> 175 bpm" },
};

const R = {
  bg: "#050508",
  bgCard: "#0d0d14",
  border: "rgba(255,255,255,0.08)",
  text: "#f0f0f5",
  textSub: "#9090a8",
  muted: "#555568",
  font: "'Inter', -apple-system, sans-serif",
  display: "'Barlow Condensed', 'Inter', sans-serif",
  rMd: "12px",
  rLg: "16px",
  rXl: "20px",
  r2xl: "28px",
  rFull: "9999px",
};
const THEME_ACCENT = "var(--primary, #22c55e)";
const THEME_ACCENT_SOFT = "var(--accent, #22c55e)";

const VO2_TREND = [
  { w: "W1", v: 44.2 },
  { w: "W2", v: 44.8 },
  { w: "W3", v: 45.1 },
  { w: "W4", v: 45.6 },
  { w: "W5", v: 45.4 },
  { w: "W6", v: 46.1 },
  { w: "W7", v: 46.5 },
  { w: "W8", v: 47.0 },
];

const ZONE_DONUT = [
  { name: "Z1 Recovery", value: 18, color: "#60a5fa", min: "5:06" },
  { name: "Z2 Aerobic", value: 28, color: "#4ade80", min: "7:59" },
  { name: "Z3 Tempo", value: 35, color: "#facc15", min: "9:59" },
  { name: "Z4 Threshold", value: 14, color: "#f97316", min: "3:59" },
  { name: "Z5 Max", value: 5, color: "#ef4444", min: "1:26" },
];

const SPLITS = [
  { km: "1 km", pace: "5:28", paceVal: 328, elev: "+8m", hr: 142, zone: 2 },
  { km: "2 km", pace: "5:24", paceVal: 324, elev: "+12m", hr: 151, zone: 3 },
  { km: "3 km", pace: "5:18", paceVal: 318, elev: "+5m", hr: 158, zone: 3 },
  { km: "4 km", pace: "5:12", paceVal: 312, elev: "-3m", hr: 162, zone: 4 },
  { km: "5 km", pace: "5:08", paceVal: 308, elev: "-8m", hr: 165, zone: 4 },
  { km: "5.4", pace: "4:52", paceVal: 292, elev: "+10m", hr: 171, zone: 4 },
];

const PACE_BARS = SPLITS.map((s) => ({
  km: s.km,
  bar: 340 - s.paceVal,
  paceStr: s.pace,
  zone: s.zone,
}));

const WEEKLY_IMPACT = [
  { day: "M", load: 320, type: "lift" },
  { day: "T", load: 168, type: "run" },
  { day: "W", load: 290, type: "lift" },
  { day: "T", load: 195, type: "run" },
  { day: "F", load: 310, type: "lift" },
  { day: "S", load: 0, type: "rest" },
  { day: "S", load: 0, type: "rest" },
];

const fmt = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 8px",
        fontFamily: R.font,
        fontSize: 10,
        fontWeight: 600,
        color: R.muted,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </p>
  );
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      style={{
        fontFamily: R.font,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: bg,
        padding: "2px 8px",
        borderRadius: R.rFull,
      }}
    >
      {children}
    </span>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <motion.div
      onClick={() => onChange(!on)}
      animate={{ background: on ? "#4ade80" : "rgba(255,255,255,0.1)" }}
      transition={{ duration: 0.2 }}
      style={{
        width: 44,
        height: 24,
        borderRadius: R.rFull,
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          position: "absolute",
          top: 2,
          width: 20,
          height: 20,
          borderRadius: R.rFull,
          background: on ? "#000" : "#fff",
        }}
      />
    </motion.div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: R.textSub,
        fontFamily: R.font,
        fontSize: 13,
        padding: 0,
        marginBottom: 20,
      }}
    >
      <ChevronLeft size={16} /> Back
    </motion.button>
  );
}

function RunMap({
  progress = 1,
  zoneColor = "#4ade80",
  height = 180,
  rounded = true,
}: {
  progress?: number;
  zoneColor?: string;
  height?: number;
  rounded?: boolean;
}) {
  const d =
    "M 38 185 L 38 128 Q 38 116 50 116 L 98 116 Q 110 116 110 104 L 110 62 Q 110 50 122 50 L 178 50 Q 190 50 190 62 L 190 98 Q 190 110 202 110 L 248 110 Q 260 110 260 98 L 260 65 Q 260 53 272 53 L 338 53";
  const totalLen = 590;
  const off = totalLen * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div
      style={{
        height,
        background: "#060b12",
        borderRadius: rounded ? R.r2xl : "0px",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.1 }}>
        <defs>
          <pattern id="rg" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rg)" />
      </svg>

      <div style={{ position: "absolute", top: 10, left: 12, opacity: 0.35 }}>
        <Navigation size={13} color={R.textSub} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          borderRadius: R.rFull,
          padding: "3px 9px",
          border: `1px solid ${R.border}`,
        }}
      >
        <span style={{ fontFamily: R.font, fontSize: 10, fontWeight: 600, color: R.text }}>5.41 km</span>
      </div>

      <svg width="100%" height="100%" viewBox="0 0 380 230" style={{ position: "absolute", inset: 0 }} preserveAspectRatio="xMidYMid meet">
        <path d={d} fill="none" stroke={zoneColor} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.07} strokeDasharray={totalLen} strokeDashoffset={off} />
        <path d={d} fill="none" stroke={zoneColor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} strokeDasharray={totalLen} strokeDashoffset={off} />
        <path
          d={d}
          fill="none"
          stroke={zoneColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLen}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
        />
        <circle cx="38" cy="185" r="5" fill={zoneColor} />
        <circle cx="38" cy="185" r="10" fill="none" stroke={zoneColor} strokeWidth={1.5} opacity={0.35} />
        {progress > 0.95 ? (
          <>
            <circle cx="338" cy="53" r="5" fill={zoneColor} />
            <circle cx="338" cy="53" r="10" fill="none" stroke={zoneColor} strokeWidth={1.5} opacity={0.35} />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function RunHub({ onStart, onDetail }: { onStart: () => void; onDetail: () => void }) {
  const legFatigue = 72;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: R.bg, minHeight: "100vh", maxWidth: 390, margin: "0 auto", padding: "0 0 110px" }}
    >
      <div style={{ padding: "52px 20px 20px", background: "linear-gradient(180deg, color-mix(in srgb, var(--primary, #22c55e) 16%, transparent) 0%, transparent 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <span style={{ fontFamily: R.font, fontSize: 10, fontWeight: 700, color: THEME_ACCENT, letterSpacing: "0.14em", textTransform: "uppercase" }}>Hybrid Performance</span>
            <h1 style={{ margin: "4px 0 0", fontFamily: R.display, fontSize: 46, fontWeight: 800, color: R.text, letterSpacing: "-0.01em", lineHeight: 1 }}>RUN</h1>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: R.rFull, background: R.bgCard, border: `1px solid ${R.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <Settings size={16} color={R.textSub} />
          </button>
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onStart}
          style={{
            width: "100%",
            height: 76,
            borderRadius: R.r2xl,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg, ${THEME_ACCENT} 0%, ${THEME_ACCENT_SOFT} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            boxShadow: "0 10px 40px color-mix(in srgb, var(--primary, #22c55e) 35%, transparent), 0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: R.rFull, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={24} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontFamily: R.display, fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>START RUN</span>
        </motion.button>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <SLabel>This Week&apos;s Load</SLabel>
            <Chip color="#818cf8" bg="rgba(129,140,248,0.12)">Week 8 of 12</Chip>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: R.display, fontSize: 38, fontWeight: 800, color: R.text, lineHeight: 1 }}>38.2</span>
                <span style={{ fontFamily: R.font, fontSize: 13, color: R.muted }}>km</span>
              </div>
              <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}>Total distance</span>
              <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: "59%" }} transition={{ duration: 1, delay: 0.3, ease: "easeOut" } as const} style={{ height: "100%", background: "#4ade80", borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>65 km goal · 59%</span>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: R.display, fontSize: 38, fontWeight: 800, color: R.text, lineHeight: 1 }}>1,240</span>
              </div>
              <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}>Training load AU</span>
              <div style={{ marginTop: 8, display: "flex", gap: 3, alignItems: "flex-end", height: 24 }}>
                {[62, 80, 45, 100, 70, 0, 0].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.05, ease: "easeOut" }}
                    style={{
                      flex: 1,
                      borderRadius: "2px 2px 0 0",
                      alignSelf: "flex-end",
                      background: h === 0 ? "rgba(255,255,255,0.04)" : h === 100 ? "#4ade80" : "#818cf8",
                      opacity: h === 0 ? 0.3 : 0.75,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                {"MTWTFSS".split("").map((d, i) => (
                  <span key={i} style={{ fontFamily: R.font, fontSize: 8, color: R.muted, flex: 1, textAlign: "center" }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ paddingTop: 16, borderTop: `1px solid ${R.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Flame size={13} color="#f97316" />
                <span style={{ fontFamily: R.font, fontSize: 12, color: R.textSub }}>Leg Fatigue Index</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: R.font, fontSize: 11, fontWeight: 700, color: "#f97316" }}>HIGH</span>
                <span style={{ fontFamily: R.display, fontSize: 18, fontWeight: 800, color: "#f97316" }}>{legFatigue}%</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #4ade80 0%, #facc15 45%, #f97316 72%, #ef4444 100%)", borderRadius: 4 }} />
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: `${100 - legFatigue}%` }}
                transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: "rgba(5,5,8,0.85)", borderRadius: "0 4px 4px 0" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontFamily: R.font, fontSize: 9, color: R.muted }}>Fresh</span>
              <span style={{ fontFamily: R.font, fontSize: 9, color: "#f97316" }}>Elevated after leg day — recovery run suggested</span>
            </div>
          </div>
        </div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={onDetail}
          style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "16px 20px", marginBottom: 12, cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <SLabel>Last Run</SLabel>
              <p style={{ margin: 0, fontFamily: R.font, fontSize: 15, fontWeight: 700, color: R.text }}>Easy Recovery Run</p>
              <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: R.muted }}>Tuesday · Feb 21 · 6:42 AM</p>
            </div>
            <ChevronRight size={16} color={R.muted} />
          </div>

          <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
            {[
              { label: "Distance", value: "5.41", unit: "km" },
              { label: "Time", value: "28:32", unit: "" },
              { label: "Avg Pace", value: "5'17\"", unit: "/km" },
            ].map((m, i) => (
              <div
                key={m.label}
                style={{
                  flex: 1,
                  paddingRight: i < 2 ? 12 : 0,
                  borderRight: i < 2 ? `1px solid ${R.border}` : "none",
                  marginRight: i < 2 ? 12 : 0,
                }}
              >
                <span style={{ fontFamily: R.display, fontSize: 24, fontWeight: 700, color: R.text }}>{m.value}</span>
                <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}>{m.unit}</span>
                <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 10, color: R.muted }}>{m.label}</p>
              </div>
            ))}
          </div>

          <div style={{ height: 5, borderRadius: 3, overflow: "hidden", display: "flex", gap: 1 }}>
            {ZONE_DONUT.map((z) => (
              <div key={z.name} style={{ flex: z.value, background: z.color, opacity: 0.85 }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {ZONE_DONUT.map((z) => (
              <div key={z.name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: z.color }} />
                <span style={{ fontFamily: R.font, fontSize: 9, color: R.muted }}>{z.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <SLabel>VO₂ Max Trend</SLabel>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: R.display, fontSize: 32, fontWeight: 800, color: R.text }}>47.0</span>
                <span style={{ fontFamily: R.font, fontSize: 12, color: R.muted }}>mL/kg/min</span>
                <Chip color="#4ade80" bg="rgba(74,222,128,0.12)">+6.3% ↑</Chip>
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <p style={{ margin: 0, fontFamily: R.font, fontSize: 10, color: R.muted }}>8-week trend</p>
              <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, fontWeight: 600, color: "#4ade80" }}>↑ Improving</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={82}>
            <AreaChart data={VO2_TREND} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
              <defs>
                <linearGradient id="vo2g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2.5} fill="url(#vo2g)" dot={false} isAnimationActive={false} />
              <XAxis dataKey="w" tick={{ fill: R.muted, fontSize: 9, fontFamily: R.font }} axisLine={false} tickLine={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

function PreRunReadiness({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const [gps, setGps] = useState<"searching" | "weak" | "locked">("searching");
  const [units, setUnits] = useState<"km" | "mi">("km");
  const [autoPause, setAutoPause] = useState(true);
  const [audioCues, setAudioCues] = useState(true);
  const [heartRate, setHeartRate] = useState(false);
  const recovery = 68;

  useEffect(() => {
    const t1 = setTimeout(() => setGps("weak"), 1800);
    const t2 = setTimeout(() => setGps("locked"), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const gpsConfig = {
    searching: {
      color: "#facc15",
      icon: <Wifi size={15} color="#facc15" />,
      label: "Searching for signal",
      sub: "Move to open area for best accuracy",
    },
    weak: {
      color: "#f97316",
      icon: <Wifi size={15} color="#f97316" />,
      label: "GPS signal weak",
      sub: "GPS signal weak — 12m accuracy · move outside",
    },
    locked: {
      color: "#4ade80",
      icon: <Wifi size={15} color="#4ade80" />,
      label: "GPS locked",
      sub: "GPS locked · Accuracy ±3m · Ready to run",
    },
  }[gps];

  const runType =
    recovery < 70
      ? {
          type: "Recovery Run",
          reason:
            "Your legs handled a high training load yesterday. An easy run flushes lactate and maintains aerobic base without adding strain.",
          color: "#60a5fa",
          icon: <Heart size={18} color="#60a5fa" />,
        }
      : {
          type: "Tempo Session",
          reason: "Recovery score is high. You have the capacity for a quality effort today.",
          color: "#facc15",
          icon: <Zap size={18} color="#facc15" />,
        };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: R.bg, minHeight: "100vh", maxWidth: 390, margin: "0 auto", padding: "52px 16px 110px" }}
    >
      <BackBtn onClick={onBack} />

      <SLabel>Pre-Run Readiness</SLabel>
      <h2 style={{ margin: "0 0 24px", fontFamily: R.display, fontSize: 32, fontWeight: 800, color: R.text }}>Ready to Run?</h2>

      <div
        style={{
          background: R.bgCard,
          border: `1px solid ${gpsConfig.color}30`,
          borderRadius: R.rXl,
          padding: "14px 16px",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: R.rFull,
            background: `${gpsConfig.color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {gps === "searching" ? (
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                position: "absolute",
                inset: -6,
                borderRadius: R.rFull,
                border: `1px solid ${gpsConfig.color}`,
                opacity: 0.4,
              }}
            />
          ) : null}
          {gpsConfig.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontFamily: R.font, fontSize: 13, fontWeight: 600, color: gpsConfig.color }}>{gpsConfig.label}</p>
          <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: R.muted }}>{gpsConfig.sub}</p>
        </div>
        {gps === "locked" ? <Check size={16} color="#4ade80" /> : null}
      </div>

      <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rXl, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={recovery > 80 ? "#4ade80" : recovery > 60 ? "#facc15" : "#f97316"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - recovery / 100)}`}
              transform="rotate(-90 26 26)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: R.display, fontSize: 14, fontWeight: 800, color: R.text }}>{recovery}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontFamily: R.font, fontSize: 13, fontWeight: 600, color: R.text }}>Recovery Score</p>
          <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: R.muted }}>Moderate — based on yesterday&apos;s 340 AU lift</p>
        </div>
        <Heart size={15} color="#f97316" />
      </div>

      <div style={{ background: `${runType.color}0d`, border: `1px solid ${runType.color}30`, borderRadius: R.rXl, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: R.rLg, background: `${runType.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>{runType.icon}</div>
          <div>
            <p style={{ margin: 0, fontFamily: R.font, fontSize: 10, fontWeight: 600, color: R.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recommended</p>
            <p style={{ margin: 0, fontFamily: R.font, fontSize: 15, fontWeight: 700, color: runType.color }}>{runType.type}</p>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: R.font, fontSize: 12, color: R.textSub, lineHeight: 1.5 }}>{runType.reason}</p>
      </div>

      <SLabel>Run Settings</SLabel>

      <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rXl, overflow: "hidden", marginBottom: 24 }}>
        {[
          {
            icon: <Target size={15} color={R.textSub} />,
            label: "Distance Units",
            sub: units === "km" ? "Kilometers" : "Miles",
            control: (
              <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.06)", borderRadius: R.rFull, padding: 3 }}>
                {(["km", "mi"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnits(u)}
                    style={{
                      height: 24,
                      paddingInline: 10,
                      borderRadius: R.rFull,
                      border: "none",
                      cursor: "pointer",
                      background: units === u ? "#818cf8" : "transparent",
                      color: units === u ? "#fff" : R.muted,
                      fontFamily: R.font,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            ),
          },
          {
            icon: <Timer size={15} color={R.textSub} />,
            label: "Auto-Pause",
            sub: "Pauses automatically when movement stops — every second counts",
            control: <Toggle on={autoPause} onChange={setAutoPause} />,
          },
          {
            icon: <Mic size={15} color={R.textSub} />,
            label: "Audio Cues",
            sub: "Pace, distance, and zone alerts",
            control: <Toggle on={audioCues} onChange={setAudioCues} />,
          },
          {
            icon: <Heart size={15} color={R.textSub} />,
            label: "Heart Rate Monitor",
            sub: heartRate ? "Connected · Polar H10" : "No device connected",
            control: <Toggle on={heartRate} onChange={setHeartRate} />,
          },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${R.border}` : "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: R.rMd, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: R.font, fontSize: 13, fontWeight: 600, color: R.text }}>{row.label}</p>
              <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: R.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</p>
            </div>
            {row.control}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 20, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: R.rLg, border: `1px solid ${R.border}` }}>
        <Shield size={13} color={R.muted} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontFamily: R.font, fontSize: 11, color: R.muted, lineHeight: 1.5 }}>Location access lets us track your route, distance, and elevation in real-time. Data stays on-device.</p>
      </div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onStart}
        disabled={gps === "searching"}
        style={{
          width: "100%",
          height: 64,
          borderRadius: R.r2xl,
          border: "none",
          cursor: gps === "searching" ? "not-allowed" : "pointer",
          background: gps === "searching" ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          boxShadow: gps !== "searching" ? "0 8px 32px rgba(34,197,94,0.32)" : "none",
          transition: "all 0.3s",
        }}
      >
        <Play size={22} color={gps === "searching" ? R.muted : "#fff"} fill={gps === "searching" ? R.muted : "#fff"} />
        <span style={{ fontFamily: R.display, fontSize: 24, fontWeight: 800, color: gps === "searching" ? R.muted : "#fff", letterSpacing: "0.04em" }}>
          {gps === "searching" ? "Acquiring GPS..." : "LAUNCH RUN"}
        </span>
      </motion.button>
    </motion.div>
  );
}

function ActiveRun({ elapsed, onPause, onSplit }: { elapsed: number; onPause: () => void; onSplit: () => void }) {
  const [currentZone, setCurrentZone] = useState(1);
  const [splits, setSplits] = useState<number[]>([]);
  const [showSplitFlash, setShowSplitFlash] = useState(false);

  const distance = Math.min(5.41, (elapsed / 1712) * 5.41);
  const zc = ZONES[currentZone];

  useEffect(() => {
    const nextZone =
      elapsed < 120 ? 1 :
      elapsed < 480 ? 2 :
      elapsed < 960 ? 3 :
      elapsed < 1320 ? 4 :
      elapsed < 1560 ? 3 : 4;
    queueMicrotask(() => {
      setCurrentZone(nextZone);
    });
  }, [elapsed]);

  const handleSplit = () => {
    setSplits((prev) => [...prev, elapsed]);
    setShowSplitFlash(true);
    setTimeout(() => setShowSplitFlash(false), 1000);
    onSplit();
  };

  const cadence = 172 + Math.floor(elapsed / 60) * 2;
  const elevation = Math.floor(distance * 6.2);
  const fatigueLoad = Math.floor(distance * 31.1);

  return (
    <div style={{ background: R.bg, minHeight: "100vh", maxWidth: 390, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${zc.color}08 0%, transparent 70%)`,
          pointerEvents: "none",
          transition: "background 0.6s ease",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <RunMap progress={distance / 5.41} zoneColor={zc.color} height={160} rounded={false} />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }}>
            <motion.div
              animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", opacity: 0.5 }}
            />
          </div>
          <span style={{ fontFamily: R.font, fontSize: 10, color: R.text, fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <motion.span
            key={Math.floor(distance * 10)}
            initial={{ y: -8, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              fontFamily: R.display,
              fontWeight: 800,
              color: THEME_ACCENT,
              fontSize: 92,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              display: "inline-block",
              textShadow: "0 0 40px color-mix(in srgb, var(--primary, #22c55e) 45%, transparent)",
              transition: "text-shadow 0.5s ease",
            }}
          >
            {distance.toFixed(2)}
          </motion.span>
          <span style={{ fontFamily: R.display, fontSize: 22, fontWeight: 600, color: R.textSub, marginLeft: 4 }}>KM</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <motion.span key={elapsed} initial={{ opacity: 0.8 }} animate={{ opacity: 1 }} style={{ fontFamily: R.display, fontSize: 42, fontWeight: 700, color: R.text, letterSpacing: "0.02em" }}>
            {fmt(elapsed)}
          </motion.span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 16, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: R.rXl, border: `1px solid ${R.border}` }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontFamily: R.display, fontSize: 28, fontWeight: 700, color: R.text }}>5:17</span>
              <span style={{ fontFamily: R.font, fontSize: 12, color: R.muted }}>/km</span>
            </div>
            <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg Pace</span>
          </div>
          <div style={{ width: 1, background: R.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontFamily: R.display, fontSize: 28, fontWeight: 700, color: R.text }}>11.3</span>
              <span style={{ fontFamily: R.font, fontSize: 12, color: R.muted }}>km/h</span>
            </div>
            <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Speed</span>
          </div>
        </div>

        <div style={{ overflowX: "auto", scrollbarWidth: "none", marginLeft: -20, marginRight: -20, paddingLeft: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, width: "max-content", paddingRight: 20 }}>
            {[
              { label: "CADENCE", value: String(cadence), unit: "spm", icon: <Activity size={13} />, accent: false },
              { label: "ELEVATION", value: `+${elevation}`, unit: "m", icon: <Mountain size={13} />, accent: false },
              { label: "ZONE", value: zc.label, unit: zc.name, icon: <Zap size={13} />, accent: true },
              { label: "LOAD", value: String(fatigueLoad), unit: "AU", icon: <Flame size={13} />, accent: false },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: m.accent ? zc.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.accent ? `${zc.color}40` : R.border}`,
                  borderRadius: R.rLg,
                  padding: "10px 14px",
                  minWidth: 96,
                  transition: "background 0.4s, border-color 0.4s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                  <span style={{ color: m.accent ? zc.color : R.muted, transition: "color 0.4s" }}>{m.icon}</span>
                  <span style={{ fontFamily: R.font, fontSize: 9, fontWeight: 600, color: R.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</span>
                </div>
                <div>
                  <span style={{ fontFamily: R.display, fontSize: 24, fontWeight: 800, color: m.accent ? zc.color : R.text, transition: "color 0.4s" }}>{m.value}</span>
                  <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}> {m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {showSplitFlash ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              style={{
                position: "absolute",
                top: 160,
                left: "50%",
                transform: "translateX(-50%)",
                background: zc.color,
                color: "#000",
                borderRadius: R.rFull,
                padding: "5px 16px",
                fontFamily: R.font,
                fontSize: 11,
                fontWeight: 700,
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            >
              Split recorded · {splits.length + 1}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "12px 32px 32px", borderTop: `1px solid ${R.border}`, background: `linear-gradient(0deg, ${R.bg} 60%, transparent 100%)` }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleSplit} style={{ width: 56, height: 56, borderRadius: R.rFull, background: R.bgCard, border: `1px solid ${R.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <Timer size={18} color={R.textSub} />
          <span style={{ fontFamily: R.font, fontSize: 8, color: R.muted, letterSpacing: "0.06em" }}>SPLIT</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.91 }}
          onClick={onPause}
          style={{ width: 76, height: 76, borderRadius: R.rFull, border: "none", cursor: "pointer", background: THEME_ACCENT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px color-mix(in srgb, var(--primary, #22c55e) 50%, transparent)", transition: "box-shadow 0.5s ease" }}
        >
          <Pause size={30} color="#000" fill="#000" />
        </motion.button>

        <motion.button whileTap={{ scale: 0.9 }} style={{ width: 56, height: 56, borderRadius: R.rFull, background: R.bgCard, border: `1px solid ${R.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <Lock size={18} color={R.textSub} />
          <span style={{ fontFamily: R.font, fontSize: 8, color: R.muted, letterSpacing: "0.06em" }}>LOCK</span>
        </motion.button>
      </div>
    </div>
  );
}

function PauseState({ onResume, onEnd }: { onResume: () => void; onEnd: () => void }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const circumference = 2 * Math.PI * 30;

  const startHold = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setHoldProgress((p) => Math.min(100, p + 5));
    }, 100);
  };

  const stopHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => {
    if (holdProgress < 100) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onEnd();
    queueMicrotask(() => {
      setHoldProgress(0);
    });
  }, [holdProgress, onEnd]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ background: "#02020a", minHeight: "100vh", maxWidth: 390, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 0 }}>
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc15" }}>
          <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc15" }} />
        </div>
        <span style={{ fontFamily: R.font, fontSize: 11, fontWeight: 700, color: "#facc15", letterSpacing: "0.18em", textTransform: "uppercase" }}>Run Paused</span>
      </motion.div>

      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} style={{ display: "flex", gap: 0, marginBottom: 32, textAlign: "center" }}>
        {[
          { v: "5.41", u: "KM" },
          { v: "28:32", u: "TIME" },
          { v: "5'17\"", u: "PACE" },
        ].map((s, i) => (
          <React.Fragment key={s.u}>
            {i > 0 ? <div style={{ width: 1, background: R.border, margin: "0 24px" }} /> : null}
            <div>
              <p style={{ margin: 0, fontFamily: R.display, fontSize: 44, fontWeight: 800, color: R.text, lineHeight: 1 }}>{s.v}</p>
              <p style={{ margin: "4px 0 0", fontFamily: R.font, fontSize: 10, fontWeight: 600, color: R.muted, letterSpacing: "0.12em" }}>{s.u}</p>
            </div>
          </React.Fragment>
        ))}
      </motion.div>

      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ width: "100%", background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rXl, padding: "16px 18px", marginBottom: 32 }}>
        <p style={{ margin: "0 0 12px", fontFamily: R.font, fontSize: 10, fontWeight: 600, color: R.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Current Load Impact</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: R.rLg, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Flame size={20} color="#f97316" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: R.display, fontSize: 22, fontWeight: 800, color: R.text }}>
              142 AU <span style={{ fontSize: 13, fontFamily: R.font, fontWeight: 400, color: "#f97316" }}>Moderate</span>
            </p>
            <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: R.muted }}>Adding to 1,240 AU weekly total · +11.5%</p>
          </div>
        </div>
        <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: "52%", height: "100%", background: "linear-gradient(90deg, #4ade80, #facc15, #f97316)", borderRadius: 2 }} />
        </div>
      </motion.div>

      <motion.button whileTap={{ scale: 0.95 }} onClick={onResume} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} style={{ width: "100%", height: 64, borderRadius: R.r2xl, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #22c55e, #15803d)", fontFamily: R.display, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "0.04em", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: "0 8px 32px rgba(34,197,94,0.35)" }}>
        <Play size={22} color="#fff" fill="#fff" />
        RESUME RUN
      </motion.button>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 72, height: 72, cursor: "pointer", userSelect: "none" }} onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={startHold} onTouchEnd={stopHold}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", inset: 0 }}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - holdProgress / 100)} transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.1s linear" }} />
          </svg>
          <motion.div animate={{ scale: holdProgress > 0 ? 0.92 : 1 }} style={{ position: "absolute", inset: 6, borderRadius: R.rFull, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Square size={22} color="#ef4444" />
          </motion.div>
        </div>
        <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}>Hold 2s to end run</span>
      </motion.div>
    </motion.div>
  );
}

function EndRunSummary({ onSave, onDetail }: { onSave: () => void; onDetail: () => void }) {
  const [rpe, setRpe] = useState(7);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const rpeColor = rpe <= 3 ? "#60a5fa" : rpe <= 5 ? "#4ade80" : rpe <= 7 ? "#facc15" : rpe <= 9 ? "#f97316" : "#ef4444";
  const rpeLabel = rpe <= 2 ? "Very Easy" : rpe <= 4 ? "Easy" : rpe <= 6 ? "Moderate" : rpe <= 8 ? "Hard" : rpe <= 9 ? "Very Hard" : "Max Effort";

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(onSave, 1200);
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: R.bg, minHeight: "100vh", maxWidth: 390, margin: "0 auto", padding: "0 0 110px" }}
    >
      <div style={{ position: "relative", marginBottom: 0 }}>
        <RunMap progress={1} zoneColor="#facc15" height={220} rounded={false} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(0deg, ${R.bg} 0%, transparent 100%)` }} />
        <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: R.rFull, padding: "5px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontFamily: R.font, fontSize: 11, fontWeight: 700, color: R.text }}>Recovery Run</span>
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(34,197,94,0.9)", borderRadius: R.rFull, padding: "5px 12px" }}>
          <span style={{ fontFamily: R.font, fontSize: 11, fontWeight: 700, color: "#000" }}>✓ Complete</span>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <h2 style={{ margin: "4px 0 4px", fontFamily: R.display, fontSize: 28, fontWeight: 800, color: R.text }}>Run Complete</h2>
        <p style={{ margin: "0 0 20px", fontFamily: R.font, fontSize: 12, color: R.muted }}>Tuesday, Feb 21 · 6:42 AM · Palo Alto</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Distance", value: "5.41", unit: "km" },
            { label: "Time", value: "28:32", unit: "" },
            { label: "Avg Pace", value: "5'17\"", unit: "/km" },
          ].map((m) => (
            <div key={m.label} style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rLg, padding: "12px 10px", textAlign: "center" }}>
              <span style={{ fontFamily: R.display, fontSize: 22, fontWeight: 800, color: R.text }}>{m.value}</span>
              <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>{m.unit}</span>
              <p style={{ margin: "3px 0 0", fontFamily: R.font, fontSize: 10, color: R.muted }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Calories", value: "312", unit: "kcal", color: "#f97316" },
            { label: "Elevation", value: "+34", unit: "m", color: "#60a5fa" },
            { label: "Avg HR", value: "157", unit: "bpm", color: "#ef4444" },
            { label: "Cadence", value: "178", unit: "spm", color: "#4ade80" },
          ].map((m) => (
            <div key={m.label} style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rLg, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontFamily: R.display, fontSize: 20, fontWeight: 800, color: R.text }}>{m.value}</span>
                <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}> {m.unit}</span>
                <p style={{ margin: "1px 0 0", fontFamily: R.font, fontSize: 10, color: R.muted }}>{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 20px", marginBottom: 12 }}>
          <SLabel>Zone Breakdown</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
              <PieChart width={120} height={120}>
                <Pie data={ZONE_DONUT} cx={60} cy={60} innerRadius={38} outerRadius={56} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0} isAnimationActive animationDuration={800}>
                  {ZONE_DONUT.map((z, i) => (
                    <Cell key={i} fill={z.color} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: R.display, fontSize: 18, fontWeight: 800, color: "#facc15" }}>Z3</span>
                <span style={{ fontFamily: R.font, fontSize: 9, color: R.muted }}>Primary</span>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {ZONE_DONUT.map((z) => (
                <div key={z.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: z.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: R.font, fontSize: 11, color: R.textSub, flex: 1 }}>{z.name}</span>
                  <span style={{ fontFamily: R.font, fontSize: 11, fontWeight: 600, color: R.textSub }}>{z.min}</span>
                  <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>{z.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 20px", marginBottom: 12 }}>
          <SLabel>Fatigue Impact Score</SLabel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: R.display, fontSize: 40, fontWeight: 800, color: "#f97316" }}>168</span>
              <span style={{ fontFamily: R.font, fontSize: 13, color: R.muted }}>AU</span>
            </div>
            <Chip color="#f97316" bg="rgba(249,115,22,0.1)">Moderate Load</Chip>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 8 }}>
            <motion.div initial={{ width: 0 }} animate={{ width: "48%" }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }} style={{ height: "100%", background: "linear-gradient(90deg, #4ade80, #facc15, #f97316)", borderRadius: 3 }} />
          </div>
          <p style={{ margin: 0, fontFamily: R.font, fontSize: 11, color: R.muted }}>Adds 168 AU to your 1,240 AU weekly total · Legs absorbed high mechanical load</p>
        </div>

        <div style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: R.r2xl, padding: "18px 20px", marginBottom: 12 }}>
          <SLabel>Recovery Protocol</SLabel>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: R.rLg, background: "rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Activity size={20} color="#818cf8" />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontFamily: R.font, fontSize: 15, fontWeight: 700, color: R.text }}>Upper Body Strength</p>
              <p style={{ margin: "0 0 8px", fontFamily: R.font, fontSize: 12, color: R.textSub, lineHeight: 1.5 }}>
                Legs absorbed high impact today (168 AU). Shift tomorrow&apos;s training to push/pull to maintain load without adding lower body stress.
              </p>
              <button onClick={() => undefined} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: R.font, fontSize: 12, fontWeight: 600, color: "#818cf8", padding: 0 }}>
                View workout →
              </button>
            </div>
          </div>
        </div>

        <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 20px", marginBottom: 12 }}>
          <SLabel>Session Notes</SLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did this run feel? Any aches, wins, or observations..."
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${R.border}`,
              borderRadius: R.rLg,
              padding: "10px 12px",
              fontFamily: R.font,
              fontSize: 13,
              color: R.text,
              resize: "none",
              outline: "none",
              minHeight: 72,
              boxSizing: "border-box",
              lineHeight: 1.5,
            }}
          />

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: R.font, fontSize: 12, color: R.textSub }}>Perceived Effort (RPE)</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: R.display, fontSize: 26, fontWeight: 800, color: rpeColor, transition: "color 0.3s" }}>{rpe}</span>
                <span style={{ fontFamily: R.font, fontSize: 11, color: R.muted }}>/10 · {rpeLabel}</span>
              </div>
            </div>
            <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)", marginBottom: 6 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${((rpe - 1) / 9) * 100}%`, background: rpeColor, borderRadius: 4, transition: "width 0.15s ease, background 0.3s ease" }} />
              <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} style={{ position: "absolute", inset: "-6px 0", opacity: 0, cursor: "pointer", width: "100%", height: "calc(100% + 12px)" }} />
              <div style={{ position: "absolute", top: "50%", left: `${((rpe - 1) / 9) * 100}%`, transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: "50%", background: rpeColor, border: "2px solid #fff", boxShadow: `0 2px 8px ${rpeColor}60`, transition: "left 0.15s ease, background 0.3s ease", pointerEvents: "none" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: R.font, fontSize: 9, color: R.muted }}>Easy</span>
              <span style={{ fontFamily: R.font, fontSize: 9, color: R.muted }}>Max Effort</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} style={{ width: "100%", height: 60, borderRadius: R.r2xl, border: "none", cursor: "pointer", background: saved ? "#4ade80" : "linear-gradient(135deg, #818cf8, #6366f1)", fontFamily: R.display, fontSize: 22, fontWeight: 800, color: saved ? "#000" : "#fff", letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: saved ? "0 6px 24px rgba(74,222,128,0.35)" : "0 6px 24px rgba(129,140,248,0.35)", transition: "background 0.4s, box-shadow 0.4s" }}>
            {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><RefreshCw size={20} color="#fff" /></motion.div> : saved ? <><Check size={22} color="#000" />RUN SAVED</> : "SAVE RUN"}
          </motion.button>
          {saved ? <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 11, color: "#4ade80", textAlign: "center" }}>Run saved · Impact logged · Weekly load updated</p> : null}

          <button onClick={onDetail} style={{ width: "100%", height: 46, borderRadius: R.rXl, border: `1px solid ${R.border}`, background: "transparent", fontFamily: R.font, fontSize: 13, fontWeight: 600, color: R.textSub, cursor: "pointer" }}>
            View detailed analysis →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function RunDetail({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"splits" | "pace" | "impact">("splits");

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: R.bg, minHeight: "100vh", maxWidth: 390, margin: "0 auto", padding: "0 0 110px" }}
    >
      <div style={{ position: "relative" }}>
        <RunMap progress={1} zoneColor="#facc15" height={240} rounded={false} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(0deg, ${R.bg} 0%, transparent 100%)` }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} style={{ position: "absolute", top: 48, left: 16, width: 38, height: 38, borderRadius: R.rFull, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={18} color={R.text} />
        </motion.button>
        <div style={{ position: "absolute", top: 48, right: 16, display: "flex", gap: 6 }}>
          {[
            { icon: <Download size={15} color={R.textSub} />, label: "Export GPX" },
            { icon: <Trash2 size={15} color="#ef4444" />, label: "Delete" },
          ].map((btn) => (
            <motion.button key={btn.label} whileTap={{ scale: 0.9 }} title={btn.label} style={{ width: 38, height: 38, borderRadius: R.rFull, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {btn.icon}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ padding: "8px 16px 0" }}>
        <h2 style={{ margin: "0 0 2px", fontFamily: R.display, fontSize: 28, fontWeight: 800, color: R.text }}>Easy Recovery Run</h2>
        <p style={{ margin: "0 0 20px", fontFamily: R.font, fontSize: 12, color: R.muted }}>Tuesday, Feb 21 · 6:42 AM · 5.41 km · 28:32</p>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            { label: "Avg Pace", value: "5'17\"", unit: "/km" },
            { label: "Calories", value: "312", unit: "kcal" },
            { label: "Elevation", value: "+34m", unit: "" },
            { label: "Avg HR", value: "157", unit: "bpm" },
          ].map((s) => (
            <div key={s.label} style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.rLg, padding: "10px 12px", flexShrink: 0, textAlign: "center" }}>
              <p style={{ margin: 0, fontFamily: R.display, fontSize: 18, fontWeight: 800, color: R.text }}>
                {s.value}
                <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>{s.unit}</span>
              </p>
              <p style={{ margin: "2px 0 0", fontFamily: R.font, fontSize: 10, color: R.muted }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: R.rLg, padding: 3, marginBottom: 16, gap: 2 }}>
          {(["splits", "pace", "impact"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <motion.button whileTap={{ scale: 0.96 }} key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, height: 34, borderRadius: R.rMd, border: "none", cursor: "pointer", background: isActive ? "#818cf8" : "transparent", color: isActive ? "#fff" : R.muted, fontFamily: R.font, fontSize: 12, fontWeight: isActive ? 600 : 500, transition: "all 0.2s", textTransform: "capitalize" }}>
                {tab}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "splits" ? (
            <motion.div key="splits" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px 52px 40px", gap: 0, padding: "10px 16px", borderBottom: `1px solid ${R.border}` }}>
                  {["KM", "PACE", "ELEV", "HR", "ZONE"].map((h) => (
                    <span key={h} style={{ fontFamily: R.font, fontSize: 9, fontWeight: 600, color: R.muted, letterSpacing: "0.08em" }}>
                      {h}
                    </span>
                  ))}
                </div>
                {SPLITS.map((s, i) => (
                  <motion.div key={s.km} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }} style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px 52px 40px", gap: 0, padding: "12px 16px", borderBottom: i < SPLITS.length - 1 ? `1px solid ${R.border}` : "none", alignItems: "center" }}>
                    <span style={{ fontFamily: R.display, fontSize: 14, fontWeight: 700, color: R.text }}>{s.km}</span>
                    <span style={{ fontFamily: R.display, fontSize: 16, fontWeight: 700, color: R.text }}>{s.pace}</span>
                    <span style={{ fontFamily: R.font, fontSize: 12, color: R.textSub }}>{s.elev}</span>
                    <span style={{ fontFamily: R.font, fontSize: 12, color: R.textSub }}>{s.hr}</span>
                    <span style={{ fontFamily: R.font, fontSize: 10, fontWeight: 700, color: ZONES[s.zone].color, background: ZONES[s.zone].bg, padding: "2px 7px", borderRadius: R.rFull }}>{ZONES[s.zone].label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}

          {activeTab === "pace" ? (
            <motion.div key="pace" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 12px 14px 4px" }}>
                <div style={{ paddingLeft: 16, marginBottom: 12 }}>
                  <SLabel>Pace by Kilometer</SLabel>
                  <p style={{ margin: 0, fontFamily: R.font, fontSize: 11, color: R.muted }}>Higher bar = faster pace · Color = heart rate zone</p>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={PACE_BARS} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="km" tick={{ fill: R.muted, fontSize: 10, fontFamily: R.font }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={(props) => {
                        const payload = props.payload as
                          | ReadonlyArray<{ payload: { paceStr: string; zone: number } }>
                          | undefined;
                        if (!props.active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "#1c1c28", border: `1px solid ${R.border}`, borderRadius: R.rMd, padding: "8px 12px", fontFamily: R.font }}>
                            <p style={{ margin: "0 0 3px", fontSize: 11, color: R.text, fontWeight: 700 }}>{d.paceStr} /km</p>
                            <p style={{ margin: 0, fontSize: 10, color: ZONES[d.zone].color }}>{ZONES[d.zone].name}</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="bar" radius={[5, 5, 0, 0]} isAnimationActive animationDuration={600}>
                      {PACE_BARS.map((b, i) => (
                        <Cell key={i} fill={ZONES[b.zone].color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingLeft: 16, marginTop: 8 }}>
                  {Object.values(ZONES)
                    .slice(1, 5)
                    .map((z) => (
                      <div key={z.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: z.color }} />
                        <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>
                          {z.label} {z.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          ) : null}

          {activeTab === "impact" ? (
            <motion.div key="impact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "18px 16px", marginBottom: 12 }}>
                <SLabel>Weekly Training Impact</SLabel>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, marginBottom: 8 }}>
                  {WEEKLY_IMPACT.map((d, i) => (
                    <div key={`${d.day}-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: d.load ? `${(d.load / 320) * 100}%` : "4px" }}
                          transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                          style={{
                            width: "100%",
                            borderRadius: "3px 3px 0 0",
                            background:
                              d.type === "run" && i === 1
                                ? "linear-gradient(180deg, #facc15, #f97316)"
                                : d.type === "lift"
                                  ? "#818cf8"
                                  : "rgba(255,255,255,0.06)",
                            opacity: d.load ? 0.85 : 0.3,
                          }}
                        />
                      </div>
                      <span style={{ fontFamily: R.font, fontSize: 9, color: i === 1 ? "#facc15" : R.muted }}>{d.day}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8" }} />
                    <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>Lift</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc15" }} />
                    <span style={{ fontFamily: R.font, fontSize: 10, color: R.muted }}>Run (this session)</span>
                  </div>
                </div>
              </div>

              <div style={{ background: R.bgCard, border: `1px solid ${R.border}`, borderRadius: R.r2xl, padding: "16px 18px" }}>
                <SLabel>Fatigue Analysis</SLabel>
                {[
                  { label: "Mechanical Load", value: "168 AU", pct: 48, color: "#f97316" },
                  { label: "Cardiovascular Load", value: "142 AU", pct: 44, color: "#60a5fa" },
                  { label: "Weekly Accumulation", value: "1,408 AU", pct: 80, color: "#ef4444" },
                ].map((f) => (
                  <div key={f.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: R.font, fontSize: 12, color: R.textSub }}>{f.label}</span>
                      <span style={{ fontFamily: R.display, fontSize: 14, fontWeight: 700, color: f.color }}>{f.value}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${f.pct}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} style={{ height: "100%", background: f.color, borderRadius: 3, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: 12, borderTop: `1px solid ${R.border}` }}>
                  <p style={{ margin: 0, fontFamily: R.font, fontSize: 11, color: R.muted, lineHeight: 1.5 }}>
                    <strong style={{ color: R.textSub }}>Recommendation:</strong> Take 36–48h before next high-intensity lower body session. Upper body strength or mobility work optimal tomorrow.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function RunPage() {
  const [screen, setScreen] = useState<RScreen>("hub");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const nav = {
    toPreRun: () => setScreen("prerun"),
    toActive: () => {
      setRunning(true);
      setScreen("active");
    },
    toPause: () => {
      setRunning(false);
      setScreen("pause");
    },
    toResume: () => {
      setRunning(true);
      setScreen("active");
    },
    toSummary: () => {
      setRunning(false);
      setScreen("summary");
    },
    toDetail: () => setScreen("detail"),
    toHub: () => {
      setElapsed(0);
      setScreen("hub");
    },
  };

  return (
    <div style={{ background: R.bg, minHeight: "100vh" }}>
      <AnimatePresence mode="wait">
        {screen === "hub" ? <RunHub key="hub" onStart={nav.toPreRun} onDetail={nav.toDetail} /> : null}
        {screen === "prerun" ? <PreRunReadiness key="prerun" onStart={nav.toActive} onBack={nav.toHub} /> : null}
        {screen === "active" ? <ActiveRun key="active" elapsed={elapsed} onPause={nav.toPause} onSplit={() => undefined} /> : null}
        {screen === "pause" ? <PauseState key="pause" onResume={nav.toResume} onEnd={nav.toSummary} /> : null}
        {screen === "summary" ? <EndRunSummary key="summary" onSave={nav.toHub} onDetail={nav.toDetail} /> : null}
        {screen === "detail" ? <RunDetail key="detail" onBack={nav.toHub} /> : null}
      </AnimatePresence>
    </div>
  );
}
