"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  ArrowRight,
  Brain,
  Flame,
  BarChart3,
  Target,
  TrendingUp,
  Crown,
  Plus,
  Send,
  Sparkles,
  CheckCircle2,
  Users,
  Timer,
  Trophy,
  Bell,
  Activity,
  Zap,
  Star,
  Camera,
  ChefHat,
  Scan,
  MessageSquare,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalorieRing } from "@/components/dashboard/calorie-ring";
import { MacroBar } from "@/components/dashboard/macro-bar";
// StreakBadge requires too many props for a demo — inline version below
import { WorkoutRecapCard } from "@/components/workout/workout-recap-card";
import { PrescriptionCard } from "@/components/coach/prescription-card";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-300">
      <Crown className="h-2.5 w-2.5" /> Pro
    </span>
  );
}

function FreeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
      <CheckCircle2 className="h-2.5 w-2.5" /> Free
    </span>
  );
}

// Phone frame wrapper for demos
function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-[280px] overflow-hidden rounded-[2.5rem] border border-white/15 bg-[oklch(0.11_0.012_264)] shadow-2xl shadow-black/50 ${className}`}
      style={{ height: 560 }}
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-black" />
      <div className="h-full overflow-hidden pt-6">
        {children}
      </div>
    </div>
  );
}

// Section container — alternating layout
function FeatureSection({
  badge,
  headline,
  sub,
  bullets,
  demo,
  flip = false,
}: {
  badge: React.ReactNode;
  headline: string;
  sub: string;
  bullets: { icon: React.ElementType; text: string }[];
  demo: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="relative py-24 md:py-32">
      <div
        className={`mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2 lg:gap-24 ${
          flip ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""
        }`}
      >
        {/* Text column */}
        <TextColumn badge={badge} headline={headline} sub={sub} bullets={bullets} />
        {/* Demo column */}
        <div className="flex justify-center">{demo}</div>
      </div>
    </section>
  );
}

function TextColumn({
  badge,
  headline,
  sub,
  bullets,
}: {
  badge: React.ReactNode;
  headline: string;
  sub: string;
  bullets: { icon: React.ElementType; text: string }[];
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {badge}
      <h2 className="text-4xl font-black leading-tight tracking-tight text-foreground md:text-5xl">
        {headline}
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed">{sub}</p>
      <ul className="space-y-3">
        {bullets.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="text-sm text-muted-foreground">{text}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── Demo 1: Workout Tracker ──────────────────────────────────────────────────

const EXERCISES = [
  { name: "Bench Press", sets: [{ reps: 8, kg: 80 }, { reps: 8, kg: 80 }, { reps: 6, kg: 85 }], muscle: "Chest" },
  { name: "Incline DB Press", sets: [{ reps: 10, kg: 30 }, { reps: 10, kg: 30 }], muscle: "Chest" },
  { name: "Cable Flye", sets: [{ reps: 12, kg: 15 }], muscle: "Chest" },
];

function WorkoutDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-80px" });

  // steps: 0=idle, 1=set logged, 2=timer, 3=next exercise
  const [step, setStep] = useState(0);
  const [timerVal, setTimerVal] = useState(60);
  const [exIdx, setExIdx] = useState(0);
  const [loggedSets, setLoggedSets] = useState<number[]>([]);

  useEffect(() => {
    if (!inView) { setStep(0); setTimerVal(60); setExIdx(0); setLoggedSets([]); return; }

    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      // Step 1: log a set after 1s
      t = setTimeout(() => {
        setLoggedSets(prev => [...prev, EXERCISES[exIdx].sets.length]);
        setStep(1);

        // Step 2: show timer after 0.5s
        t = setTimeout(() => {
          setStep(2);
          let count = 60;
          const countdown = setInterval(() => {
            count -= 1;
            setTimerVal(count);
            if (count <= 48) {
              clearInterval(countdown);
              // Step 3: next exercise
              setStep(3);
              t = setTimeout(() => {
                setExIdx(prev => (prev + 1) % EXERCISES.length);
                setLoggedSets([]);
                setStep(0);
                setTimerVal(60);
                t = setTimeout(run, 800);
              }, 800);
            }
          }, 80);
        }, 600);
      }, 1200);
    };
    t = setTimeout(run, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, exIdx]);

  const ex = EXERCISES[exIdx];

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)]">
        {/* Header */}
        <div className="shrink-0 border-b border-white/8 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active</p>
              <p className="text-[15px] font-black text-foreground">Push Day</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1">
              <Timer className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-bold tabular-nums text-primary">42:18</span>
            </div>
          </div>
        </div>

        {/* Rest timer pill */}
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              initial={{ y: -32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -32, opacity: 0 }}
              className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[12px] font-bold text-amber-300">Rest Timer</span>
              </div>
              <span className="tabular-nums text-[18px] font-black text-amber-300">{timerVal}s</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exercise card */}
        <div className="flex-1 overflow-hidden px-4 py-3 space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={exIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-white/10 bg-white/4 p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-black text-foreground">{ex.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ex.muscle}</p>
                </div>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {ex.sets.length} sets
                </span>
              </div>

              {/* Set rows */}
              <div className="space-y-1.5">
                {ex.sets.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                  >
                    <span className="text-[10px] text-muted-foreground">Set {i + 1}</span>
                    <span className="text-[12px] font-bold tabular-nums text-foreground">
                      {s.reps} × {s.kg}kg
                    </span>
                    {i < (loggedSets[0] ?? 0) - 1 || step >= 1 && i === (loggedSets[0] ?? 1) - 1 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-white/20" />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Log Set glow */}
              <AnimatePresence>
                {step === 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="mt-3 w-full rounded-xl bg-primary py-2.5 text-[12px] font-black text-primary-foreground shadow-lg shadow-primary/30"
                    style={{ boxShadow: "0 0 18px oklch(0.7 0.2 264/0.4)" }}
                  >
                    Log Set
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>

          {/* Volume chip */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-white/8 bg-white/4 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Volume</p>
              <p className="text-[16px] font-black tabular-nums text-foreground">3,840<span className="text-[10px] font-normal text-muted-foreground">kg</span></p>
            </div>
            <div className="flex-1 rounded-xl border border-white/8 bg-white/4 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Sets Done</p>
              <p className="text-[16px] font-black tabular-nums text-foreground">6<span className="text-[10px] font-normal text-muted-foreground">/9</span></p>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 2: Progress ─────────────────────────────────────────────────────────

const VOLUME_DATA = [28, 34, 31, 42, 38, 47, 52];
const PR_DATA = [
  { name: "Bench Press", value: "100kg", icon: "🏋️" },
  { name: "Squat", value: "140kg", icon: "🦵" },
  { name: "Deadlift", value: "160kg", icon: "💪" },
  { name: "OHP", value: "72kg", icon: "🔝" },
];

function ProgressDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [barsVisible, setBarsVisible] = useState(false);
  const [prsVisible, setPrsVisible] = useState(false);
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const maxVol = Math.max(...VOLUME_DATA);

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setBarsVisible(true), 300);
    const t2 = setTimeout(() => setPrsVisible(true), 1000);
    const t3 = setTimeout(() => setHeatmapVisible(true), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [inView]);

  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const heatCells = [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0];

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)] px-4 py-4 space-y-4 overflow-y-auto">
        {/* Volume chart */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="mb-3 text-[11px] font-bold text-foreground">Weekly Volume (k)</p>
          <div className="flex items-end gap-1.5 h-20">
            {VOLUME_DATA.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <motion.div
                  className="w-full rounded-t-md"
                  style={{ background: "oklch(0.7 0.2 264)" }}
                  initial={{ height: 0 }}
                  animate={barsVisible ? { height: `${(v / maxVol) * 76}px` } : { height: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                />
                <span className="text-[8px] text-muted-foreground">{days[i]}</span>
              </div>
            ))}
          </div>
          {/* Tooltip over last bar */}
          <AnimatePresence>
            {barsVisible && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-2 flex justify-end"
              >
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">↑ 52k this week 🔥</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PRs */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="mb-3 text-[11px] font-bold text-foreground">Personal Records</p>
          <div className="grid grid-cols-2 gap-2">
            {PR_DATA.map((pr, i) => (
              <AnimatePresence key={pr.name}>
                {prsVisible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-2.5 text-center"
                  >
                    <span className="text-base">{pr.icon}</span>
                    <p className="mt-0.5 text-[14px] font-black text-amber-300">{pr.value}</p>
                    <p className="text-[9px] text-muted-foreground">{pr.name}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        </div>

        {/* Activity heatmap mini */}
        <AnimatePresence>
          {heatmapVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/4 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold text-foreground">28-Day Activity</p>
                <span className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
                  <Flame className="h-2.5 w-2.5" /> 12d streak
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {heatCells.map((active, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.025 }}
                    className="aspect-square rounded-sm"
                    style={{
                      background: active
                        ? "oklch(0.7 0.2 264 / 0.8)"
                        : "oklch(0.2 0.01 264 / 0.5)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 3: Nutrition ────────────────────────────────────────────────────────

const MEALS = [
  {
    name: "Breakfast",
    icon: "🥣",
    foods: [
      { name: "Oatmeal", cal: 310, protein: 12 },
      { name: "Protein Shake", cal: 150, protein: 30 },
    ],
  },
  {
    name: "Lunch",
    icon: "🥗",
    foods: [
      { name: "Chicken & Rice", cal: 520, protein: 45 },
      { name: "Greek Yogurt", cal: 120, protein: 17 },
    ],
  },
];

function NutritionDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [ringPct, setRingPct] = useState(0);
  const [proteinPct, setProteinPct] = useState(0);
  const [carbsPct, setCarbsPct] = useState(0);
  const [fatPct, setFatPct] = useState(0);
  const [mealsVisible, setMealsVisible] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => {
      setRingPct(77);
      setProteinPct(82);
      setCarbsPct(65);
      setFatPct(58);
    }, 300);
    const t2 = setTimeout(() => setMealsVisible(true), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [inView]);

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)] px-4 py-4 space-y-4 overflow-y-auto">
        {/* Calorie ring */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <div className="flex items-center gap-4">
            <CalorieRing
              consumed={Math.round(2000 * ringPct / 100)}
              goal={2000}
            />
            <div className="flex-1 space-y-2">
              <MacroBar label="Protein" value={Math.round(200 * proteinPct / 100)} goal={200} textColorClass="text-blue-400" barColorClass="bg-blue-400" />
              <MacroBar label="Carbs" value={Math.round(250 * carbsPct / 100)} goal={250} textColorClass="text-amber-400" barColorClass="bg-amber-400" />
              <MacroBar label="Fat" value={Math.round(70 * fatPct / 100)} goal={70} textColorClass="text-rose-400" barColorClass="bg-rose-400" />
            </div>
          </div>
        </div>

        {/* Meal sections */}
        {MEALS.map((meal, mi) => (
          <AnimatePresence key={meal.name}>
            {mealsVisible && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: mi * 0.2 }}
                className="rounded-2xl border border-white/10 bg-white/4 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">{meal.icon}</span>
                  <p className="text-[12px] font-bold text-foreground">{meal.name}</p>
                </div>
                <div className="space-y-2">
                  {meal.foods.map((food, fi) => (
                    <motion.div
                      key={food.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: mi * 0.2 + fi * 0.12 + 0.15 }}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                    >
                      <span className="text-[11px] text-foreground">{food.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-400">{food.protein}g</span>
                        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{food.cal} kcal</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 4: Accountability Pods ─────────────────────────────────────────────

const POD_MEMBERS = [
  { name: "Alex", avatar: "🏆", streak: 14, online: true },
  { name: "Jordan", avatar: "💪", streak: 7, online: false },
  { name: "Sam", avatar: "🔥", streak: 21, online: true },
  { name: "Riley", avatar: "⚡", streak: 5, online: false },
];

function PodsDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-80px" });

  const [step, setStep] = useState(0);
  // 0=members appear, 1=activity slide in, 2=ping bell, 3=challenge fill, 4=reset

  useEffect(() => {
    if (!inView) { setStep(0); return; }
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      setStep(0);
      t = setTimeout(() => setStep(1), 1200);
      t = setTimeout(() => setStep(2), 2400);
      t = setTimeout(() => setStep(3), 3600);
      t = setTimeout(() => { setStep(0); t = setTimeout(loop, 600); }, 8000);
    };
    t = setTimeout(loop, 400);
    return () => clearTimeout(t);
  }, [inView]);

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)] px-4 py-4 space-y-3 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-black text-foreground">Iron Squad 🏋️</p>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">4 members</span>
        </div>

        {/* Member cards */}
        <div className="grid grid-cols-2 gap-2">
          {POD_MEMBERS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={step >= 0 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ delay: i * 0.1 + 0.1 }}
              className="relative rounded-xl border border-white/10 bg-white/4 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{m.avatar}</span>
                <div>
                  <p className="text-[11px] font-bold text-foreground">{m.name}</p>
                  <p className="text-[9px] text-muted-foreground">🔥 {m.streak}d</p>
                </div>
              </div>
              {/* Online dot */}
              {m.online && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
              {/* Bell animation on Jordan */}
              {m.name === "Jordan" && step >= 2 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, -15, 15, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px]"
                >
                  <Bell className="h-2.5 w-2.5 text-white" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Activity feed */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-white/10 bg-white/4 p-3 space-y-2"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activity</p>
              <div className="flex items-center gap-2">
                <span className="text-base">🏆</span>
                <p className="text-[11px] text-foreground">
                  <span className="font-bold">Alex</span> just hit a PR — 120kg Squat!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <p className="text-[11px] text-foreground">
                  <span className="font-bold">Sam</span> is on a 21-day streak
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weekly challenge */}
        <AnimatePresence>
          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/4 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold text-foreground">Weekly Challenge</p>
                <span className="text-[10px] text-muted-foreground">68%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: "68%" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="mt-1.5 text-[9px] text-muted-foreground">Volume: 13,600 / 20,000 kg</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 5: AI Coach ─────────────────────────────────────────────────────────

const CHAT_SCRIPT = [
  { role: "ai", text: "Hey! I've reviewed your Push Day session. Want a quick breakdown?" },
  { role: "user", text: "Yeah, how'd I do?" },
  {
    role: "ai",
    text: "Solid session 💪 Volume up 8% vs last week. Your bench felt heavier — I recommend deloading 10% next session.",
    card: "recap",
  },
  { role: "user", text: "What should I eat after?" },
  {
    role: "ai",
    text: "You need ~50g protein to hit your macro goal. I've lined up a high-protein dinner below 👇",
    card: "meal",
  },
];

function AICoachDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-80px" });
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!inView) { setVisibleCount(0); return; }
    let t: ReturnType<typeof setTimeout>;
    const delays = [600, 1800, 3200, 4800, 6400];
    delays.forEach((d, i) => {
      t = setTimeout(() => setVisibleCount(i + 1), d);
    });
    // loop after last message
    t = setTimeout(() => setVisibleCount(0), 10000);
    const loopT = setTimeout(() => {
      setVisibleCount(0);
    }, 10200);
    return () => { clearTimeout(t); clearTimeout(loopT); };
  }, [inView]);

  const mockRecap = {
    summary: "Solid push day 💪 Volume up 8% vs last week. Your bench felt heavier — consider deloading 10% next session.",
    highlights: ["Volume up 8% vs last week", "New 1RM: Bench 100kg", "Best set: 8×80kg Bench Press"],
    improvement_tip: "Deload bench 10% next session to allow full recovery.",
    volume_trend: "up" as const,
  };

  const mockMeal = {
    name: "Post-Workout Recovery Bowl",
    calories: 620,
    protein: 52,
    carbs: 68,
    fat: 14,
    ingredients: ["200g chicken breast", "150g brown rice", "Mixed veggies"],
    prepTime: "20 min",
  };

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)]">
        {/* Header */}
        <div className="shrink-0 border-b border-white/8 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20">
            <Brain className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-[13px] font-black text-foreground">AI Coach</p>
            <p className="text-[10px] text-emerald-400">● Online</p>
          </div>
          <ProBadge />
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <AnimatePresence>
            {CHAT_SCRIPT.slice(0, visibleCount).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "border border-white/10 bg-white/6 text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Inline cards */}
          <AnimatePresence>
            {visibleCount >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <WorkoutRecapCard recap={mockRecap} loading={false} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {visibleCount >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <MealSuggestionCard meal={mockMeal} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2">
            <span className="flex-1 text-[12px] text-muted-foreground">Ask your coach...</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
              <Send className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 6: Food Scanner ─────────────────────────────────────────────────────

const SCAN_ITEMS = [
  { name: "Grilled Chicken", emoji: "🍗", cal: 280, protein: 42, carbs: 0, fat: 8, confidence: 0.96 },
  { name: "Brown Rice", emoji: "🍚", cal: 215, protein: 5, carbs: 45, fat: 2, confidence: 0.91 },
  { name: "Broccoli", emoji: "🥦", cal: 55, protein: 4, carbs: 8, fat: 0.5, confidence: 0.88 },
];

function FoodScannerDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [scanStep, setScanStep] = useState(0);
  // 0=camera, 1=scanning ring, 2=results

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setScanStep(1), 500);
    const t2 = setTimeout(() => setScanStep(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [inView]);

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)]">
        {/* Header */}
        <div className="shrink-0 border-b border-white/8 px-4 py-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-violet-400" />
          <p className="text-[13px] font-black text-foreground">Food Scanner</p>
          <ProBadge />
        </div>

        {/* Camera / scanning area */}
        <AnimatePresence mode="wait">
          {scanStep < 2 ? (
            <motion.div
              key="camera"
              exit={{ opacity: 0 }}
              className="relative mx-4 mt-4 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black"
            >
              {/* fake camera feed gradient */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 60%, oklch(0.4 0.1 130) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex flex-col items-center gap-2">
                {scanStep === 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <Scan className="h-8 w-8 text-white/60" />
                    <p className="text-[11px] text-white/60">Point at your meal</p>
                  </div>
                )}
                {scanStep === 1 && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-400"
                    >
                      <Scan className="h-7 w-7 text-violet-400" />
                    </motion.div>
                    <p className="text-[11px] text-violet-300 font-bold">Analyzing...</p>
                  </>
                )}
              </div>
              {/* corner brackets */}
              {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
                <div key={pos} className={`absolute ${pos} h-5 w-5 border-violet-400`}
                  style={{
                    borderTop: pos.includes("top") ? "2px solid" : "none",
                    borderBottom: pos.includes("bottom") ? "2px solid" : "none",
                    borderLeft: pos.includes("left") ? "2px solid" : "none",
                    borderRight: pos.includes("right") ? "2px solid" : "none",
                    borderColor: "oklch(0.7 0.2 290)",
                  }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
              <p className="text-[11px] font-bold text-foreground">Detected Items</p>
              {SCAN_ITEMS.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="rounded-xl border border-white/10 bg-white/4 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-bold text-foreground">{item.name}</p>
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {item.cal} kcal · {item.protein}g protein · {item.carbs}g carbs · {item.fat}g fat
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="w-full rounded-xl bg-primary py-2.5 text-[12px] font-black text-primary-foreground"
              >
                Log All Items
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {scanStep < 2 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground">Results appear here</p>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

// ─── Demo 7: Workout Recap ────────────────────────────────────────────────────

function WorkoutRecapDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, [inView]);

  const mockRecap = {
    summary: "Strong lower body session 🦵 Volume up 12% vs last week. Two new PRs — Squat and Deadlift both improved.",
    highlights: [
      "Squat volume up 12% vs last week",
      "New 1RM: Deadlift 160kg",
      "Best endurance: 5 sets without drop-off",
    ],
    improvement_tip: "Add hip flexor mobility work before squats next session.",
    volume_trend: "up" as const,
  };

  const mockPrescription = {
    exercise_name: "Squat",
    target_weight_kg: 130,
    target_reps: 6,
    target_sets: 4,
    rationale: "Deload 5% to allow full recovery after two PRs.",
    readiness_factor: "maintain" as const,
    progressive_overload_pct: -5.0,
  };

  return (
    <PhoneFrame>
      <div ref={ref} className="flex h-full flex-col bg-[oklch(0.11_0.012_264)] px-4 py-4 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <p className="text-[13px] font-black text-foreground">Workout Recap</p>
          <ProBadge />
        </div>
        <AnimatePresence>
          {visible && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <WorkoutRecapCard recap={mockRecap} loading={false} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <PrescriptionCard prescription={mockPrescription} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

// ─── MealSuggestionCard inline (lightweight) ──────────────────────────────────

function MealSuggestionCard({ meal }: { meal: { name: string; calories: number; protein: number; carbs: number; fat: number; ingredients: string[]; prepTime: string } }) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 p-4">
      <div className="mb-2 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-violet-400" />
        <p className="text-[12px] font-bold text-violet-300">{meal.name}</p>
      </div>
      <div className="mb-2 flex gap-3">
        <span className="text-[10px] text-muted-foreground">{meal.calories} kcal</span>
        <span className="text-[10px] text-blue-400">{meal.protein}g protein</span>
        <span className="text-[10px] text-amber-400">{meal.carbs}g carbs</span>
      </div>
      <div className="space-y-1">
        {meal.ingredients.map((ing) => (
          <div key={ing} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="h-1 w-1 rounded-full bg-violet-400" />
            {ing}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">⏱ {meal.prepTime}</p>
    </div>
  );
}

// ─── Pro Tier Divider ─────────────────────────────────────────────────────────

function ProDivider() {
  return (
    <div className="relative py-24 text-center">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-64 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 50%, oklch(0.55 0.25 290/0.12) 0%, transparent 70%)",
        }}
      />
      {/* Gradient line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      <div className="relative inline-flex flex-col items-center gap-4">
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-1.5 text-[11px] font-black uppercase tracking-widest text-violet-300">
          ✦ Pro Features
        </span>
        <h2 className="text-3xl font-black tracking-tight text-foreground">
          Unlock AI-powered coaching
        </h2>
        <p className="max-w-md text-muted-foreground">
          Personalized AI insights, instant food scanning, and adaptive programming — built into your daily training.
        </p>
        <Link href="/upgrade">
          <Button variant="default" size="lg" className="gap-2">
            Upgrade to Pro <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-white/6 bg-[oklch(0.09_0.012_264/0.85)]">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-primary" />
        <span className="text-[15px] font-black tracking-tight text-foreground">FitHub</span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Sign in
          </Button>
        </Link>
        <Link href="/signup">
          <Button variant="default" size="sm">
            Get started
          </Button>
        </Link>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 30%, oklch(0.55 0.25 264/0.15) 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center gap-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
          <Zap className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Your AI-powered fitness OS
          </span>
        </div>
        <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-foreground md:text-7xl">
          Train smarter.<br />
          <span className="text-primary">Recover better.</span><br />
          Get stronger.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          FitHub tracks every rep, monitors your recovery, and uses AI to coach you like a personal trainer — all in your pocket.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="gap-2 px-8">
              Start for free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="gap-2">
              Sign in
            </Button>
          </Link>
        </div>
        {/* Social proof */}
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex -space-x-2">
            {["🧑‍💪", "👩‍🏋️", "🏃", "💪"].map((e, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/6 text-sm"
              >
                {e}
              </span>
            ))}
          </div>
          <span className="text-[13px]">Join 12,000+ athletes already training with FitHub</span>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <section className="relative py-32 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 50% 100%, oklch(0.55 0.25 264/0.12) 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative flex flex-col items-center gap-6"
      >
        <h2 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
          Your best season starts now.
        </h2>
        <p className="max-w-lg text-muted-foreground">
          No credit card needed for the free tier. Upgrade whenever you&apos;re ready for AI coaching.
        </p>
        <Link href="/signup">
          <Button size="lg" className="gap-2 px-10">
            Get started free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.09_0.012_264)] text-foreground">
      <Nav />
      <Hero />

      {/* ── FREE FEATURES ────────────────────────────────────────────── */}

      {/* Section 1: Workout Tracking */}
      <FeatureSection
        badge={<FreeBadge />}
        headline="Track every rep. In real time."
        sub="Log sets with one tap. The rest timer starts automatically so you never lose your rhythm. Volume, PRs, and progress — all tracked without thinking about it."
        bullets={[
          { icon: Dumbbell, text: "One-tap set logging with weight + reps" },
          { icon: Timer, text: "Auto rest timer after every set" },
          { icon: TrendingUp, text: "Live volume tracking per exercise" },
          { icon: Activity, text: "Works offline — syncs when you reconnect" },
        ]}
        demo={<WorkoutDemo />}
      />

      {/* Section 2: Progress & Analytics */}
      <FeatureSection
        flip
        badge={<FreeBadge />}
        headline="Watch your progress compound."
        sub="Volume charts, personal records, and a GitHub-style training heatmap show you exactly how consistent you&apos;ve been — and what to do next."
        bullets={[
          { icon: BarChart3, text: "Weekly volume trends with peak highlights" },
          { icon: Trophy, text: "Auto-detected personal records per exercise" },
          { icon: Flame, text: "Streak tracking with milestone badges" },
          { icon: Target, text: "28-day activity heatmap" },
        ]}
        demo={<ProgressDemo />}
      />

      {/* Section 3: Nutrition Logging */}
      <FeatureSection
        badge={<FreeBadge />}
        headline="Nutrition that fits your training."
        sub="Log meals by section — breakfast through dinner. See your calorie ring and macro bars fill in real time, keeping you on target without obsessing over numbers."
        bullets={[
          { icon: Target, text: "Calorie and macro goals personalized at onboarding" },
          { icon: Plus, text: "Add foods to any meal section fast" },
          { icon: Heart, text: "Fiber, sugar, and sodium tracking included" },
          { icon: Star, text: "Quick-add recent foods with one tap" },
        ]}
        demo={<NutritionDemo />}
      />

      {/* Section 4: Accountability Pods */}
      <FeatureSection
        flip
        badge={<FreeBadge />}
        headline="Train with your crew."
        sub="Create pods of 2–8 athletes. Share PRs, fire pings to check on each other, and compete on weekly challenges that actually keep everyone showing up."
        bullets={[
          { icon: Users, text: "Pods of 2–8 with real-time activity feed" },
          { icon: Bell, text: "Ping teammates who haven't trained today" },
          { icon: Trophy, text: "Weekly volume and consistency challenges" },
          { icon: Flame, text: "Shared streak visibility across the pod" },
        ]}
        demo={<PodsDemo />}
      />

      {/* ── PRO DIVIDER ──────────────────────────────────────────────── */}
      <ProDivider />

      {/* ── PRO FEATURES ─────────────────────────────────────────────── */}

      {/* Section 5: AI Coach */}
      <FeatureSection
        badge={<ProBadge />}
        headline="An AI coach that knows your data."
        sub="Ask anything about your session, your recovery, or your nutrition. The coach reads your actual workout history and gives personalized, actionable advice — not generic tips."
        bullets={[
          { icon: Brain, text: "Trained on your workouts, PRs, and macros" },
          { icon: MessageSquare, text: "Conversational — ask follow-up questions naturally" },
          { icon: Dumbbell, text: "Can modify your active workout mid-session" },
          { icon: Sparkles, text: "Generates meal suggestions based on your remaining macros" },
        ]}
        demo={<AICoachDemo />}
      />

      {/* Section 6: Food Scanner */}
      <FeatureSection
        flip
        badge={<ProBadge />}
        headline="Scan your meal. Done."
        sub="Point your camera at any plate and FitHub's vision AI identifies every item — calories, protein, carbs, fat. Tap to log. No barcodes, no manual search."
        bullets={[
          { icon: Camera, text: "AI vision identifies food items instantly" },
          { icon: Scan, text: "Confidence scores per item — edit if needed" },
          { icon: Plus, text: "Log all items at once with one tap" },
          { icon: Star, text: "Works on restaurant plates, home cooking, packaged food" },
        ]}
        demo={<FoodScannerDemo />}
      />

      {/* Section 7: Workout Recap */}
      <FeatureSection
        badge={<ProBadge />}
        headline="A full debrief after every session."
        sub="The moment you finish, the AI generates a personalized recap — what went well, what to adjust, and your exact prescription for the next session."
        bullets={[
          { icon: Sparkles, text: "Auto-generated session highlights and trends" },
          { icon: TrendingUp, text: "Volume, intensity, and recovery insights" },
          { icon: Crown, text: "Personalized next-session prescription" },
          { icon: CheckCircle2, text: "Improvement tips based on your history" },
        ]}
        demo={<WorkoutRecapDemo />}
      />

      <FooterCTA />
    </div>
  );
}
