"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  Loader2,
  Target,
  Calendar,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROGRAM_BUILDER_ENABLED } from "@/lib/features";

const GOALS = [
  { value: "hypertrophy", label: "Muscle Growth", icon: "💪" },
  { value: "strength", label: "Strength", icon: "🏋️" },
  { value: "powerbuilding", label: "Powerbuilding", icon: "⚡" },
  { value: "general_fitness", label: "General Fitness", icon: "🎯" },
  { value: "body_recomp", label: "Body Recomp", icon: "🔄" },
  { value: "athletic", label: "Athletic Performance", icon: "🏃" },
];

const EQUIPMENT_OPTIONS = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "band", label: "Bands" },
];

const FOCUS_AREAS = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "legs", label: "Legs" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "core", label: "Core" },
];

export default function NewProgramPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipment, setEquipment] = useState<string[]>(["barbell", "dumbbell", "cable", "machine"]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  function toggleEquipment(val: string) {
    setEquipment((prev) =>
      prev.includes(val) ? prev.filter((e) => e !== val) : [...prev, val],
    );
  }

  function toggleFocus(val: string) {
    setFocusAreas((prev) =>
      prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val],
    );
  }

  async function handleGenerate() {
    if (!goal) return;
    setGenerating(true);
    setError(null);
    setProgressMessage(null);

    try {
      const res = await fetch("/api/ai/program-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          weeks,
          days_per_week: daysPerWeek,
          equipment_available: equipment,
          focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if ((data as { limitReached?: boolean }).limitReached) {
          setError("Daily limit reached (3/day). Try again tomorrow.");
        } else {
          setError((data as { error?: string }).error || "Failed to generate program");
        }
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (eventType === "progress") {
              setProgressMessage((data.current_week_focus as string) ?? "Building your program...");
            } else if (eventType === "done") {
              router.push(`/programs/${data.program_id as string}`);
              return;
            } else if (eventType === "error") {
              setError((data.error as string) || "Generation failed");
              return;
            }
          }
        }
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setGenerating(false);
    }
  }

  if (!PROGRAM_BUILDER_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <Brain className="size-8 text-muted-foreground/30" />
        <p className="mt-3 text-[13px] text-muted-foreground">Program builder is not enabled.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-4">
      {/* Back */}
      <button
        onClick={() => router.push("/programs")}
        className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Programs
      </button>

      {/* Title */}
      <div>
        <h1 className="text-[18px] font-black text-foreground">Build a Program</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          AI generates a periodized training plan tailored to your goals
        </p>
      </div>

      {/* Goal selection */}
      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Target className="mr-1 inline size-3" />
          Goal
        </label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <motion.button
              key={g.value}
              whileTap={{ scale: 0.97 }}
              onClick={() => setGoal(g.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                goal === g.value
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border/40 bg-card/30 text-muted-foreground hover:bg-card/50",
              )}
            >
              <span className="text-[14px]">{g.icon}</span>
              <p className="mt-0.5 text-[11px] font-bold">{g.label}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Calendar className="mr-1 inline size-3" />
          Duration — {weeks} weeks
        </label>
        <input
          type="range"
          min={4}
          max={12}
          value={weeks}
          onChange={(e) => setWeeks(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50">
          <span>4 weeks</span>
          <span>12 weeks</span>
        </div>
      </div>

      {/* Days per week */}
      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Dumbbell className="mr-1 inline size-3" />
          Training Days — {daysPerWeek}/week
        </label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((d) => (
            <motion.button
              key={d}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDaysPerWeek(d)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-[13px] font-bold transition-colors",
                daysPerWeek === d
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/40 bg-card/30 text-muted-foreground",
              )}
            >
              {d}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Equipment Available
        </label>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <motion.button
              key={eq.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleEquipment(eq.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors",
                equipment.includes(eq.value)
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border/40 bg-card/30 text-muted-foreground",
              )}
            >
              {eq.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Focus areas (optional) */}
      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Focus Areas <span className="font-normal">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_AREAS.map((fa) => (
            <motion.button
              key={fa.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleFocus(fa.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors",
                focusAreas.includes(fa.value)
                  ? "border-sky-400/25 bg-sky-400/10 text-sky-400"
                  : "border-border/40 bg-card/30 text-muted-foreground",
              )}
            >
              {fa.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-2 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* Generate button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleGenerate}
        disabled={!goal || generating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-40"
      >
        {generating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating program...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generate Program
          </>
        )}
      </motion.button>

      {generating && (
        <p className="text-center text-[10px] text-muted-foreground">
          {progressMessage
            ? `Building week — ${progressMessage}`
            : "Designing your program..."}
        </p>
      )}
    </div>
  );
}
