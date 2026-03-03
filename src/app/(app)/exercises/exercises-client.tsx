"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExerciseRow } from "./page";

const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  arms: "bg-amber-500/20 text-amber-400",
  core: "bg-cyan-500/20 text-cyan-400",
  full_body: "bg-primary/20 text-primary",
};

const EQUIPMENT_BADGE_COLORS: Record<string, string> = {
  barbell: "bg-slate-500/20 text-slate-400",
  dumbbell: "bg-orange-500/20 text-orange-400",
  kettlebell: "bg-yellow-500/20 text-yellow-400",
  cable: "bg-teal-500/20 text-teal-400",
  machine: "bg-indigo-500/20 text-indigo-400",
  bodyweight: "bg-lime-500/20 text-lime-400",
  band: "bg-fuchsia-500/20 text-fuchsia-400",
};

function ExerciseCard({ ex, muscleGroupLabels, equipmentLabels }: {
  ex: ExerciseRow;
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-border/50 bg-card/40 overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ex.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                MUSCLE_BADGE_COLORS[ex.muscle_group] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {muscleGroupLabels[ex.muscle_group] ?? ex.muscle_group}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                EQUIPMENT_BADGE_COLORS[ex.equipment] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {equipmentLabels[ex.equipment] ?? ex.equipment}
            </span>
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
              {ex.category}
            </span>
          </div>
        </div>
        <span className="ml-2 shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && ex.instructions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-3 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{ex.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ExercisesClient({
  exercises,
  muscleGroups,
  equipmentTypes,
  muscleGroupLabels,
  equipmentLabels,
}: {
  exercises: ExerciseRow[];
  muscleGroups: string[];
  equipmentTypes: string[];
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [activeMuscle, setActiveMuscle] = useState("all");
  const [activeEquipment, setActiveEquipment] = useState("all");

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchMuscle = activeMuscle === "all" || ex.muscle_group === activeMuscle;
      const matchEquip = activeEquipment === "all" || ex.equipment === activeEquipment;
      const matchQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
      return matchMuscle && matchEquip && matchQuery;
    });
  }, [exercises, activeMuscle, activeEquipment, query]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Muscle filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveMuscle("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeMuscle === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {muscleGroups.map((mg) => (
          <button
            key={mg}
            onClick={() => setActiveMuscle(mg === activeMuscle ? "all" : mg)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeMuscle === mg
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {muscleGroupLabels[mg] ?? mg}
          </button>
        ))}
      </div>

      {/* Equipment filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveEquipment("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeEquipment === "all"
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Any equipment
        </button>
        {equipmentTypes.map((eq) => (
          <button
            key={eq}
            onClick={() => setActiveEquipment(eq === activeEquipment ? "all" : eq)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeEquipment === eq
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {equipmentLabels[eq] ?? eq}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-muted-foreground">
        Showing {filtered.length} of {exercises.length} exercises
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No exercises match your filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              muscleGroupLabels={muscleGroupLabels}
              equipmentLabels={equipmentLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
